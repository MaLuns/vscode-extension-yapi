import { Disposable, QuickInput, QuickInputButton, QuickInputButtons, QuickPickItem, window } from "vscode";

interface QuickPickParameters<T extends QuickPickItem> {
    title: string;
    step: number;
    totalSteps: number;
    items: T[];
    activeItem?: T;
    ignoreFocusOut?: boolean;
    placeholder: string;
}

interface InputBoxParameters {
    title: string;
    step: number;
    totalSteps: number;
    prompt: string;
    value?: string;
    validate: (value: string) => Promise<string | undefined>;
    ignoreFocusOut?: boolean;
    placeholder?: string;
}

type InputStep = (input: MultiStepInput) => Thenable<InputStep | void>;


/**
 * 点击按钮类型
 */
enum InputFlowAction {
    /**
     * 返回上一层
     */
    back,
    /**
     * 取消
     */
    cancel,
}

export default class MultiStepInput {
    private current?: QuickInput;
    private steps: InputStep[] = [];

    static async run<T>(start: InputStep) {
        const input = new MultiStepInput();
        return input.stepThrough(start);
    }

    private async stepThrough<T>(start: InputStep) {
        let step: InputStep | void = start;
        while (step) {
            this.steps.push(step);
            if (this.current) {
                this.current.enabled = false;
                this.current.busy = true;
            }
            try {
                step = await step(this);
            } catch (err) {
                if (err === InputFlowAction.back) {
                    this.steps.pop();
                    step = this.steps.pop();
                } else if (err === InputFlowAction.cancel) {
                    step = undefined;
                } else {
                    throw err;
                }
            }
        }
        if (this.current) {
            this.current.dispose();
        }
    }

    /**
     * 显示 - 下拉框
     * @param param
     * @returns 
     */
    async showQuickPick<T extends QuickPickItem, P extends QuickPickParameters<T>>({ title, step, totalSteps, items, activeItem, ignoreFocusOut, placeholder }: P) {
        const disposables: Disposable[] = [];
        try {
            return new Promise<T>((resolve, reject) => {
                const input = window.createQuickPick<T>();
                input.title = title;
                input.step = step;
                input.totalSteps = totalSteps;
                input.ignoreFocusOut = ignoreFocusOut ?? false;
                input.placeholder = placeholder;
                input.items = items;
                if (activeItem) {
                    input.activeItems = [activeItem];
                }

                input.buttons = [
                    ...(this.steps.length > 1 ? [QuickInputButtons.Back] : [])
                ];

                disposables.push(
                    input.onDidTriggerButton(item => {
                        if (item === QuickInputButtons.Back) {
                            reject(InputFlowAction.back);
                        } else {
                            resolve(<any>item);
                        }
                    }),
                    input.onDidChangeSelection(items => resolve(items[0])),
                    input.onDidHide(() => {
                        (async () => {
                            reject(InputFlowAction.cancel);
                        })()
                            .catch(reject);
                    })
                );

                if (this.current) {
                    this.current.dispose();
                }
                this.current = input;
                this.current.show();
            });
        } catch (error) {
            disposables.forEach(d => d.dispose());
        }
    }

    /**
     * 显示 - 输入框
     * @param param0 
     */
    async showInputBox<P extends InputBoxParameters>({ title, step, totalSteps, value, prompt, validate, ignoreFocusOut, placeholder }: P) {
        const disposables: Disposable[] = [];
        try {
            return new Promise<string>((resolve, reject) => {
                const input = window.createInputBox();
                input.title = title;
                input.step = step;
                input.totalSteps = totalSteps;
                input.value = value || '';
                input.prompt = prompt;
                input.ignoreFocusOut = ignoreFocusOut ?? false;
                input.placeholder = placeholder;
                input.buttons = [
                    ...(this.steps.length > 1 ? [QuickInputButtons.Back] : []),
                ];
                let validating = validate('');
                disposables.push(
                    input.onDidTriggerButton(item => {
                        if (item === QuickInputButtons.Back) {
                            reject(InputFlowAction.back);
                        } else {
                            resolve(<any>item);
                        }
                    }),
                    input.onDidAccept(async () => {
                        const value = input.value;
                        input.enabled = false;
                        input.busy = true;
                        if (!(await validate(value))) {
                            resolve(value);
                        }
                        input.enabled = true;
                        input.busy = false;
                    }),
                    input.onDidChangeValue(async text => {
                        const current = validate(text);
                        validating = current;
                        const validationMessage = await current;
                        if (current === validating) {
                            input.validationMessage = validationMessage;
                        }
                    }),
                    input.onDidHide(() => {
                        reject(InputFlowAction.cancel);
                    })
                );
                if (this.current) {
                    this.current.dispose();
                }
                this.current = input;
                this.current.show();
            });
        } catch (error) {
            disposables.forEach(d => d.dispose());
        }
    }
}
export const FORM_FIELD_CONTEXT_KEY = Symbol.for("form-field");

export type FormFieldContext = {
  inputId: string;
  labelId: string;
};

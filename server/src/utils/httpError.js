// messageAr (optional): the same message in Arabic, sent next to it so Arabic visitors read it in Arabic
export const httpError = (status, message, messageAr) =>
  Object.assign(new Error(message), { status, ...(messageAr ? { messageAr } : {}) })
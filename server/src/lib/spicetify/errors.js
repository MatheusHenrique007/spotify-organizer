export class SpicetifyError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'SpicetifyError';
    this.code = code;
    this.details = details;
  }
}

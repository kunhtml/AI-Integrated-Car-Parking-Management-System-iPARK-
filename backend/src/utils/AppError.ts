export class AppError extends Error {
  status: number;
  statusCode: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.statusCode = status;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

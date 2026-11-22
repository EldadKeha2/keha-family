export class HttpError extends Error {
  constructor(status,message,code=null){super(message);this.status=status;this.code=code;}
}

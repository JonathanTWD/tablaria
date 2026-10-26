export interface ApiErrorDetail {
  path: string;
  message: string;
}

/** Body returned by the API for every error response. */
export interface ApiErrorBody {
  statusCode: number;
  error: string;
  message: string;
  details?: ApiErrorDetail[];
}

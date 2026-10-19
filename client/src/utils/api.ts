import axios from "axios";
import type { AxiosRequestConfig } from "axios";
import { Page } from "../types/models";
import { apiFieldLabel, translateServerMessage } from "./serverMessages";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export function formatApiError(value: unknown): string {
  if (typeof value === "string") return translateServerMessage(value);
  if (Array.isArray(value)) return value.map(formatApiError).join(" ");
  if (value && typeof value === "object") {
    return Object.entries(value)
      .map(
        ([key, val]) =>
          `${["detail", "non_field_errors"].includes(key) ? "" : `${apiFieldLabel(key)}: `}${formatApiError(val)}`,
      )
      .join(" ");
  }
  return "Bir sorun oluştu. Lütfen tekrar dene.";
}

export const api = axios.create({
  baseURL: "/api/",
  timeout: 20000,
  withCredentials: false,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
    "Accept-Language": "tr",
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isCancel(error)) return Promise.reject(error);
    const status = error.response?.status || 0;
    if (status === 401 && error.config?.headers?.Authorization) {
      window.dispatchEvent(new Event("bindirim:unauthorized"));
    }
    const body = error.response?.data;
    const text =
      body && typeof body === "object"
        ? formatApiError(body)
        : error.code === "ECONNABORTED"
          ? "İstek zaman aşımına uğradı. Lütfen tekrar dene."
          : "Bindirim’e ulaşılamadı. Django API’nin 8000 numaralı portta çalıştığından emin ol.";
    return Promise.reject(new ApiError(text, status));
  },
);

export async function request<T>(
  path: string,
  token?: string,
  config: AxiosRequestConfig = {},
): Promise<T> {
  const response = await api.request<T>({
    ...config,
    url: path,
    headers: {
      ...config.headers,
      ...(token ? { Authorization: `Token ${token}` } : {}),
    },
  });
  return response.data;
}

export async function listAll<T>(
  path: string,
  token: string,
  signal?: AbortSignal,
): Promise<T[]> {
  const results: T[] = [];
  let pageNumber = 1;
  while (true) {
    const page = await request<Page<T>>(path, token, {
      params: { page: pageNumber },
      signal,
    });
    results.push(...page.results);
    if (!page.next) return results;
    pageNumber += 1;
  }
}

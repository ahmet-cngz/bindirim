import { AxiosError } from "axios";
import { api, ApiError, formatApiError, listAll, request } from "./api";

const originalAdapter = api.defaults.adapter;
afterEach(() => {
  api.defaults.adapter = originalAdapter;
  jest.restoreAllMocks();
});

test("sends the DRF token and JSON through the shared Axios instance", async () => {
  api.defaults.adapter = async (config) => {
    expect(config.baseURL).toBe("/api/");
    expect(config.headers.get("Authorization")).toBe("Token test-token");
    expect(JSON.parse(config.data)).toEqual({ target_price: "2400" });
    return {
      data: { id: 1 },
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    };
  };
  await expect(
    request("watches/1/", "test-token", {
      method: "PATCH",
      data: { target_price: "2400" },
    }),
  ).resolves.toEqual({ id: 1 });
});

test("invalid authenticated sessions dispatch an expiry event", async () => {
  const expired = jest.fn();
  window.addEventListener("bindirim:unauthorized", expired);
  api.defaults.adapter = async (config) => {
    throw new AxiosError(
      "Unauthorized",
      "ERR_BAD_REQUEST",
      config,
      {},
      {
        status: 401,
        statusText: "Unauthorized",
        data: { detail: "Invalid token." },
        headers: {},
        config,
      },
    );
  };
  try {
    await expect(request("auth/me/", "expired-token")).rejects.toMatchObject({
      message: "Oturumun geçersiz. Lütfen yeniden giriş yap.",
      status: 401,
    });
    expect(expired).toHaveBeenCalledTimes(1);
  } finally {
    window.removeEventListener("bindirim:unauthorized", expired);
  }
});

test("returns actionable network errors without losing their API error type", async () => {
  api.defaults.adapter = async (config) => {
    throw new AxiosError("Network Error", "ERR_NETWORK", config);
  };
  await expect(request("watches/", "test-token")).rejects.toBeInstanceOf(
    ApiError,
  );
  await expect(request("watches/", "test-token")).rejects.toMatchObject({
    status: 0,
    message: expect.stringContaining("Django API"),
  });
});

test("paginates through the same endpoint without following an external next URL", async () => {
  const urls: string[] = [];
  api.defaults.adapter = async (config) => {
    urls.push(config.url!);
    const page = config.params.page;
    return {
      data: {
        count: 2,
        next: page === 1 ? "https://untrusted.example/page/2" : null,
        previous: null,
        results: [{ id: page }],
      },
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    };
  };
  await expect(listAll("watches/", "test-token")).resolves.toEqual([
    { id: 1 },
    { id: 2 },
  ]);
  expect(urls).toEqual(["watches/", "watches/"]);
});

test("preserves DRF field-level validation messages", () => {
  expect(
    formatApiError({
      url: ["You already track this product."],
      target_price: ["Must be positive."],
    }),
  ).toBe(
    "Ürün bağlantısı: Bu ürün zaten takip listende. Hedef fiyat: Değer sıfırdan büyük olmalı.",
  );
});

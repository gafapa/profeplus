import { afterEach, expect, it, vi } from "vitest";
import { obtainMoodleToken } from "./auth";
import type { ProxyTransport } from "./client";

const server = "https://school.example/aula/";
afterEach(() => vi.useRealTimers());

it("sends credentials only in an encoded HTTPS POST and returns only the public token", async () => {
  const transport: ProxyTransport = vi.fn(async (request) => {
    expect(request.url).toBe(`${server}login/token.php`);
    expect(request.method).toBe("POST");
    expect(Object.fromEntries(new URLSearchParams(request.body))).toEqual({ username: "teacher", password: " secret&+=ñ ", service: "read_only" });
    return { status: 200, finalUrl: request.url, bodyText: JSON.stringify({ token: "abc123", privatetoken: "DO_NOT_RETURN" }) };
  });
  await expect(obtainMoodleToken(server, " teacher ", " secret&+=ñ ", "read_only", { transport })).resolves.toBe("abc123");
  expect(transport).toHaveBeenCalledTimes(1);
});

it.each([
  { errorcode: "invalidlogin", error: "password SECRET" },
  { errorcode: "servicenotavailable", message: "SECRET" },
  { token: "<SECRET>" },
  { privatetoken: "SECRET" },
  null
])("rejects unsafe or failed responses without displaying raw messages: %j", async (body) => {
  const transport: ProxyTransport = async (request) => ({ status: 200, finalUrl: request.url, bodyText: JSON.stringify(body) });
  const error = await obtainMoodleToken(server, "user", "SECRET", "moodle_mobile_app", { transport }).catch((cause: Error) => cause);
  expect(error).toBeInstanceOf(Error);
  expect(String(error)).not.toContain("SECRET");
});

it.each(["http://school.example/", "https://user:password@school.example/", "https://school.example/?password=secret"])("rejects unsafe server %s before transport", async (url) => {
  const transport = vi.fn();
  await expect(obtainMoodleToken(url, "user", "secret", "moodle_mobile_app", { transport })).rejects.toThrow();
  expect(transport).not.toHaveBeenCalled();
});

it("rejects redirected login responses", async () => {
  const transport: ProxyTransport = async () => ({ status: 200, finalUrl: "https://other.example/login", bodyText: '{"token":"abc123"}' });
  await expect(obtainMoodleToken(server, "user", "secret", "moodle_mobile_app", { transport })).rejects.toThrow("respuesta de acceso válida");
});

it("cancels even if transport ignores abort and never retries", async () => {
  const controller = new AbortController();
  const transport = vi.fn(() => new Promise<never>(() => {}));
  const pending = obtainMoodleToken(server, "user", "secret", "moodle_mobile_app", { transport, signal: controller.signal });
  controller.abort();
  await expect(pending).rejects.toThrow("interrumpió");
  expect(transport).toHaveBeenCalledTimes(1);
});

it("times out without leaking transport errors", async () => {
  vi.useFakeTimers();
  const pending = obtainMoodleToken(server, "user", "secret", "moodle_mobile_app", { transport: () => new Promise<never>(() => {}) });
  const assertion = expect(pending).rejects.toThrow("tiempo de espera");
  await vi.advanceTimersByTimeAsync(45_000);
  await assertion;
});

const { expect } = require('@playwright/test');

async function login(request, identifier, password) {
  const response = await request.post('/api/auth/login', { data: { identifier, password } });
  expect(response.ok(), `login ${identifier}: ${response.status()}`).toBeTruthy();
  const body = await response.json();
  expect(body.accessToken).toBeTruthy();
  return body.accessToken;
}

function auth(token) { return { Authorization: `Bearer ${token}` }; }

async function tank(request, token, plant, id) {
  const response = await request.get(`/api/plants/${plant}/tanks`, { headers: auth(token) });
  expect(response.ok()).toBeTruthy();
  const found = (await response.json()).find((item) => item.id === id);
  expect(found, `tanque ${id} en ${plant}`).toBeTruthy();
  return found;
}

async function action(request, token, plant, id, path, data) {
  const response = await request.post(`/api/plants/${plant}/tanks/${id}/${path}`, { headers: auth(token), data });
  expect(response.ok(), `${path}: HTTP ${response.status()} ${await response.text()}`).toBeTruthy();
  return response;
}

module.exports = { login, auth, tank, action };

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';

describe('Health Check API Route', () => {
  it('GET /api/health returns 200 and healthy status message', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body.message).toContain('College Marketplace API is healthy');
    expect(response.body.data).toHaveProperty('timestamp');
  });

  it('GET /api/non-existent-route returns 404 with structured error response', async () => {
    const response = await request(app).get('/api/non-existent-route');

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('message');
  });

  it('sets security headers via Helmet', async () => {
    const response = await request(app).get('/api/health');

    expect(response.headers).toHaveProperty('x-request-id');
    expect(response.headers).toHaveProperty('x-dns-prefetch-control');
  });
});

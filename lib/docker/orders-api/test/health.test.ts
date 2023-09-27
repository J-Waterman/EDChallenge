import request from 'supertest';
import { app } from '../src/index';

// Test the /health endpoint
describe('/health endpoint', () => {
    it('should respond with Healthy', async () => {
        const response = await request(app).get('/health');
        expect(response.status).toBe(200);
        expect(response.text).toBe('Healthy');
    });
});
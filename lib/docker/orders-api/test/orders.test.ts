import request from 'supertest';
import express from 'express';
import { S3 } from 'aws-sdk';
import { Order } from '../src/models/Order';
import { app } from '../src/index';

// mock the AWS SDK S3 instance methods
jest.mock('aws-sdk', () => {
    return {
        S3: jest.fn().mockImplementation(() => {
            return {
                listObjectsV2: jest.fn().mockReturnValue({
                    promise: jest.fn().mockResolvedValue({
                        Contents: [
                            { Key: 'orders_test.json' }
                        ]
                    })
                }),
                getObject: jest.fn().mockReturnValue({ promise: jest.fn().mockResolvedValue({
                    Body: JSON.stringify([{ client_id: 1, event_id: 1, order_id: 1 }])
                    })
                }),
            };
        }),
    };
});

describe('/orders endpoint', () => {
    beforeAll(() => {
        process.env.PORT = '8080';
        process.env.BUCKET_NAME = 'test-bucket';
    });

    it('should respond with orders', async () => {
        const response = await request(app).get('/orders');
        expect(response.status).toBe(200);
    });
});
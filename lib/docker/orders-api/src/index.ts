import express from 'express';
import { S3 } from 'aws-sdk';
import { Order } from './models/Order';

export const app = express();
const s3 = new S3();

const PORT = parseInt(process.env.PORT || '8080');
const BUCKET_NAME = process.env.BUCKET_NAME || '';

app.get('/orders', async (req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Request Received from IP: ${req.ip} for endpoint: ${req.path}`);

    try {
        const { client_id, event_id } = req.query;

        const list = await s3.listObjectsV2({ Bucket: BUCKET_NAME }).promise();

        let orders: Order[] = [];
        for (const item of list.Contents || []) {
            const data = await s3.getObject({ Bucket: BUCKET_NAME, Key: item.Key || '' }).promise();
            let newOrders: Order[] = JSON.parse(data.Body?.toString('utf-8') || '');

            if (client_id) {
                newOrders = newOrders.filter(order => order.client_id === parseInt(client_id as string));
            }
            if (event_id) {
                newOrders = newOrders.filter(order => order.event_id === parseInt(event_id as string));
            }

            orders = orders.concat(newOrders);
        }

        if (!orders.length) {
            console.log(`[${timestamp}] Response sent with an empty list of orders to IP: ${req.ip}`);
        }

        res.json(orders);
    } catch (error) {
        console.log(error)
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

app.get('/health', (req, res) => {
    res.status(200).send('Healthy');
});

if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`Orders API listening on port ${PORT}`)
    });
}
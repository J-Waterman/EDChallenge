import express from 'express';
import { S3 } from 'aws-sdk';
import { Order } from '../../../models/Order';

const app = express();
const s3 = new S3();

const PORT = parseInt(process.env.PORT) || 8080;
const BUCKET_NAME = process.env.BUCKET_NAME || '';

app.get('/orders', async (req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Request Received from IP: ${req.ip} for endpoint: ${req.path}`);

    try {
        const { client, event_id } = req.query;

        const list = await s3.listObjectsV2({ Bucket: BUCKET_NAME }).promise();

        let orders: Order[] = [];
        for (const item of list.Contents || []) {
            const data = await s3.getObject({ Bucket: BUCKET_NAME, Key: item.Key || '' }).promise();
            const fileOrders: Order[] = JSON.parse(data.Body?.toString('utf-8') || '');

            if (client) {
                orders = orders.concat(fileOrders.filter(order => order.client_id === parseInt(client as string)));
            } else if (event_id) {
                orders = orders.concat(fileOrders.filter(order => order.event_id === parseInt(event_id as string)));
            } else {
                orders = orders.concat(fileOrders);
            }
        }

        if (!orders.length) {
            console.log(`[${timestamp}] Response sent with an empty list of orders to IP: ${req.ip}`);
        }

        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

app.listen(PORT, () => {
   console.log(`Orders API listening on port ${PORT}`)
});
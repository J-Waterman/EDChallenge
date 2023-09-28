import { OrdersStack } from '../lib/orders-stack';
import { PipelineStack } from "../lib/pipeline-stack";
import { App } from "aws-cdk-lib";

const account = "846020691102"
const regionUS = "us-east-1"

const env = [
    {
        account: account,
        region: regionUS
    }
]

const app = new App();

env.forEach((env) => {
    new OrdersStack(app, 'OrdersStack', {
        env: env
    });
    new PipelineStack(app, 'PipelineStack', {
        env: env
    });
});
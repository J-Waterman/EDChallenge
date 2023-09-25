import { App } from '@aws-cdk/core';
import { OrdersStack } from '../lib/orders-stack';
import { PipelineStack } from "../lib/pipeline-stack";

const app = new App();
new OrdersStack(app, 'OrdersStack');
new PipelineStack(app, 'PipelineStack');
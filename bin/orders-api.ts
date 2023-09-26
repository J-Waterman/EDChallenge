import { OrdersStack } from '../lib/orders-stack';
import { PipelineStack } from "../lib/pipeline-stack";
import {App} from "aws-cdk-lib";

const app = new App();
new OrdersStack(app, 'OrdersStack');
new PipelineStack(app, 'PipelineStack');
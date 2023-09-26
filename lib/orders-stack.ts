import {App, CfnOutput, Duration, Stack, StackProps} from "aws-cdk-lib";
import {Peer, Port, SecurityGroup, Vpc} from "aws-cdk-lib/aws-ec2";
import {Bucket} from "aws-cdk-lib/aws-s3";
import {BucketDeployment, Source} from "aws-cdk-lib/aws-s3-deployment";
import {ContainerImage, FargateService, FargateTaskDefinition, LogDrivers, Cluster} from "aws-cdk-lib/aws-ecs";
import {LogGroup, MetricFilter, RetentionDays} from "aws-cdk-lib/aws-logs";
import {ApplicationLoadBalancer, ListenerAction} from "aws-cdk-lib/aws-elasticloadbalancingv2";
import {Alarm, ComparisonOperator} from "aws-cdk-lib/aws-cloudwatch";

export class OrdersStack extends Stack {

    constructor(scope: App, id: string, props?: StackProps) {
        super(scope, id, props);

        const vpc = this.createVpc();
        const ordersBucket = this.createOrdersBucket();

        const cluster = this.createEcsCluster(vpc);
        const taskDefinition = this.createTaskDefinition(ordersBucket);

        const logGroup = this.setupLogging();
        const service = this.createEcsService(cluster, taskDefinition, vpc, logGroup, ordersBucket);
        const loadBalancer = this.createLoadBalancer(vpc, service);

        // Outputs
        new CfnOutput(this, 'LoadBalancerDNS', {
            value: loadBalancer.loadBalancerDnsName,
            description: 'Load Balancer DNS Name',
        });
    }

    createVpc() {
        return new Vpc(this, 'OrdersVpc');
    }

    createOrdersBucket() {
        const ordersBucket = new Bucket(this, 'OrdersBucket');
        new BucketDeployment(this, 'DeployTestData', {
            sources: [Source.asset('./resources')],
            destinationBucket: ordersBucket
        });
        return ordersBucket;
    }

    createEcsCluster(vpc: Vpc) {
        return new Cluster(this, 'OrdersCluster', { vpc: vpc });
    }

    createTaskDefinition(ordersBucket: Bucket) {
        return new FargateTaskDefinition(this, 'OrdersTaskDefinition');
    }

    createEcsService(cluster: Cluster, taskDefinition: FargateTaskDefinition, vpc: Vpc, logGroup: LogGroup, ordersBucket: Bucket) {
        const container = taskDefinition.addContainer('OrdersContainer', {
            image: ContainerImage.fromAsset('lib/docker/orders-api'),
            memoryLimitMiB: 512,
            cpu: 256,
            environment: {
                BUCKET_NAME: ordersBucket.bucketName,
                PORT: '8080'
            },
            logging: LogDrivers.awsLogs({
                streamPrefix: 'API-Logs-',
                logGroup: logGroup,
            })
        });

        container.addPortMappings({
            containerPort: 8080,
        })

        // ECS Fargate Service
        const service = new FargateService(this, 'OrdersService', {
            cluster: cluster,
            taskDefinition: taskDefinition,
            securityGroups: [
                new SecurityGroup(this,
                    'OrdersSecurityGroup',
                    {
                        vpc: vpc,
                        allowAllOutbound: true,
                        description: 'Allow all outbound traffic',
                    })
            ],
            desiredCount: 1,
        });

        // Allow the ECS service to access the S3 bucket
        ordersBucket.grantReadWrite(service.taskDefinition.taskRole);

        return service;
    }

    createLoadBalancer(vpc: Vpc, service: FargateService) {
        // Load Balancer Security Group
        const lbSecurityGroup = new SecurityGroup(this, 'LoadBalancerSecurityGroup', {
            vpc: vpc,
            allowAllOutbound: true,
            description: 'Allow all inbound HTTP traffic',
        });

        lbSecurityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(80));

        // Application Load Balancer
        const loadBalancer = new ApplicationLoadBalancer(this, 'OrdersLoadBalancer', {
            vpc: vpc,
            internetFacing: true,
            securityGroup: lbSecurityGroup,
        });

        // Add listener to the ALB
        const listener = loadBalancer.addListener('Listener', {
            port: 80,
            defaultAction: ListenerAction.fixedResponse(404)
        });

        // Attach the ECS Fargate Service to the ALB
        listener.addTargets('ECS', {
            port: 80,
            targets: [service.loadBalancerTarget({
                containerName: 'OrdersContainer',
                containerPort: 8080
            })],
            healthCheck: {
                path: '/health',  // You might want to define a health check endpoint in your Express app
                interval: Duration.seconds(30),
            },
        });

        // Update the security group of the ECS service to allow traffic from the ALB
        service.connections.allowFrom(loadBalancer, Port.tcp(8080));

        return loadBalancer;
    }

    setupLogging() {
        const logGroup = new LogGroup(this, 'OrdersApiLogGroup', {
            logGroupName: `/ecs/event-dynamic-challenge`,
            retention: RetentionDays.ONE_WEEK
        });

        const emptyOrdersMetric = new MetricFilter(this, 'EmptyOrdersMetricFilter', {
            logGroup,
            metricNamespace: 'OrdersApi',
            metricName: 'EmptyOrderResponses',
            filterPattern: { logPatternString: 'Response sent with an empty list of orders' }
        });

        const emptyOrdersMetricPeriod = emptyOrdersMetric.metric().with({ period: Duration.minutes(5) });

        new Alarm(this, 'EmptyOrdersAlarm', {
            metric: emptyOrdersMetricPeriod,
            threshold: 5,
            evaluationPeriods: 1,
            datapointsToAlarm: 1,
            alarmDescription: 'Alarm when 5 or more responses with empty order lists are detected in a 5 minute period',
            comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD
        });

        return logGroup;
    }
}
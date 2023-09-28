import {App, SecretValue, Stack, StackProps} from "aws-cdk-lib";
import {PolicyStatement, Role, ServicePrincipal} from "aws-cdk-lib/aws-iam";
import {Artifact, Pipeline} from "aws-cdk-lib/aws-codepipeline";
import {CodeBuildAction, GitHubSourceAction} from "aws-cdk-lib/aws-codepipeline-actions";
import {BuildSpec, LinuxBuildImage, Project} from "aws-cdk-lib/aws-codebuild";

export class PipelineStack extends Stack {
    constructor(scope: App, id: string, props?: StackProps) {
        super(scope, id, props);

        const codeBuildRole = new Role(this, 'CodeBuildRole', {
            assumedBy: new ServicePrincipal('codebuild.amazonaws.com')
        })
        codeBuildRole.addToPolicy(new PolicyStatement({
            resources: ['*'],
            actions: [
                'cloudformation:*',
                'ssm:*',
                'ecr:*',
                's3:*'
            ]
        }))

        // Define a Github repository as a source
        const sourceOutput = new Artifact();
        const sourceAction = new GitHubSourceAction({
            actionName: 'GitHub_Source',
            owner: 'J-Waterman',
            repo: 'EDChallenge',
            oauthToken: SecretValue.secretsManager('githubOAuthToken', { jsonField: 'githubToken' }),
            output: sourceOutput,
            branch: 'main',
        });

        // Define a CodeBuild project
        const project = new Project(this, 'EDChallengeProject', {
            buildSpec: BuildSpec.fromObject({
                version: '0.2',
                phases: {
                    install: {
                        'runtime-versions': {
                            'nodejs': 18
                        },
                        commands: [
                            'npm install -g aws-cdk',
                            'npm install -g typescript',
                        ]
                    },
                    pre_build: {
                        commands: [
                            'docker build -t orders-api ./lib/docker/orders-api/'
                        ]
                    },
                    build: {
                        commands: [
                            'cd lib/docker/orders-api',
                            'npm install',
                            'npm run test'
                        ]
                    }
                }
            }),
            role: codeBuildRole,
            environment: {
                buildImage: LinuxBuildImage.AMAZON_LINUX_2_5,
                privileged: true
            },
        });

        const buildOutput = new Artifact();
        const buildAction = new CodeBuildAction({
            actionName: 'CodeBuild',
            project: project,
            input: sourceOutput,
            outputs: [buildOutput],
        });

        // Define a CodeBuild project for deployment
        const deployProject = new Project(this, 'EDChallengeDeployProject', {
            buildSpec: BuildSpec.fromObject({
                version: '0.2',
                phases: {
                    install: {
                        'runtime-versions': {
                            'nodejs': 18
                        },
                        commands: [
                            'npm ci',
                            'npm install -g typescript',
                            'npm install -g aws-cdk'
                        ]
                    },
                    build: {
                        commands: [
                            'cdk synth'
                        ]
                    },
                    post_build: {
                        commands: [
                            'cdk deploy OrdersStack --require-approval never --verbose'
                        ]
                    }
                }
            }),
            role: codeBuildRole,
            environment: {
                buildImage: LinuxBuildImage.AMAZON_LINUX_2_5,
                privileged: true
            },
        });

        const deployAction = new CodeBuildAction({
            actionName: 'CDK_Deploy',
            project: deployProject,
            input: sourceOutput
        });

        // Create a pipeline
        new Pipeline(this, 'EDChallengePipeline', {
            stages: [
                {
                    stageName: 'Source',
                    actions: [sourceAction],
                },
                {
                    stageName: 'Build',
                    actions: [buildAction],
                },
                {
                    stageName: 'Deploy',
                    actions: [deployAction],
                }
            ],
        });
    }
}
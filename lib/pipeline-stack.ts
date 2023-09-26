import { Stack, StackProps, App, SecretValue } from '@aws-cdk/core';
import { Pipeline, Artifact } from '@aws-cdk/aws-codepipeline';
import { CodeBuildAction, GitHubSourceAction } from '@aws-cdk/aws-codepipeline-actions';
import { Project, BuildSpec, LinuxBuildImage } from '@aws-cdk/aws-codebuild';
import { Role, ServicePrincipal, PolicyStatement } from '@aws-cdk/aws-iam';

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
                            'npm install',
                            'docker build -t orders-api ./lib/docker/orders-api/'
                        ]
                    },
                    build: {
                        commands: [
                            'cd lib/docker/orders-api',
                            'npm run test'
                        ]
                    }
                }
            }),
            environment: {
                buildImage: LinuxBuildImage.AMAZON_LINUX_2_3,
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
                            'npm install -g aws-cdk',
                            'npm install -g typescript',
                        ]
                    },
                    build: {
                        commands: [
                            'cdk deploy OrdersStack --require-approval never'
                        ]
                    }
                }
            }),
            environment: {
                buildImage: LinuxBuildImage.AMAZON_LINUX_2_3
            },
        });

        const deployAction = new CodeBuildAction({
            actionName: 'CDK_Deploy',
            project: deployProject,
            input: buildOutput
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
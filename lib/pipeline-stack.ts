import { Stack, StackProps, App, SecretValue } from '@aws-cdk/core';
import { Pipeline, Artifact } from '@aws-cdk/aws-codepipeline';
import { CodeBuildAction, GitHubSourceAction } from '@aws-cdk/aws-codepipeline-actions';
import { Project, BuildSpec, LinuxBuildImage } from '@aws-cdk/aws-codebuild';

export class PipelineStack extends Stack {
    constructor(scope: App, id: string, props?: StackProps) {
        super(scope, id, props);

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
                            'docker build -t orders-api ./lib/docker/orders-api/'  // Assuming Dockerfile is at this path
                        ]
                    },
                    build: {
                        commands: [
                            'cd orders-api',
                            'npm run test'
                        ]
                    },
                    post_build: {
                        commands: [
                            'cdk deploy OrdersStack --require-approval never'
                        ]
                    }
                }
            }),
            environment: {
                buildImage: LinuxBuildImage.STANDARD_5_0,
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
            ],
        });
    }
}
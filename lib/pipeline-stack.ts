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
                version: '1.0',
                phases: {
                    pre_build: {
                        commands: [
                            'cd lib/docker/orders-api/',
                            '$(aws ecr get-login --no-include-email --region AWS_REGION )' // Login to ECR
                        ]
                    },
                    build: {
                        commands: [
                            'docker build -t my-image-name .',
                            'docker tag my-image-name:latest my-ecr-repo-url:latest',
                            'docker push my-ecr-repo-url:latest'
                        ]
                    },
                    post_build: {
                        commands: 'cdk deploy'
                    }
                }
            }),
            environment: {
                buildImage: LinuxBuildImage.STANDARD_4_0,
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
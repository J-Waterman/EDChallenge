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
                version: '0.3',
                phases: {
                    build: {
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
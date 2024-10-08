#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { Stage } from "./src/constants";
import { Tagger } from "./src/aspects";
import { GalleryStack, GalleryUsEast1Stack } from "./src/stacks/Gallery";

const app = new cdk.App();

const galleryUsEast1Stack = new GalleryUsEast1Stack(
  app,
  "GalleryUsEast1Stack",
  {
    stackName: "GalleryUsEast1Stack",
    description:
      "DevopsDays gallery resources that needs to forcly be in us-east-1",
    env: { account: process.env.CDK_DEFAULT_ACCOUNT },
  }
);
cdk.Aspects.of(galleryUsEast1Stack).add(new Tagger({ stage: Stage.PROD }));

const galleryStack = new GalleryStack(app, "GalleryStack", {
  stackName: "GalleryStack",
  description:
    "DevopsDays gallery website resources",
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  cloudFrontCertificate: galleryUsEast1Stack.cloudFrontCertificate,
  crossRegionReferences: true,
});
cdk.Aspects.of(galleryStack).add(new Tagger({ stage: Stage.PROD }));

import * as fs from "fs";
import * as path from "path";
import { IAspect, Tag, Stack } from "aws-cdk-lib";
import { IConstruct } from "constructs";

import { Stage } from "../constants";

/**
 * Tagger aspect input properties
 */
interface TaggerProps {
  /**
   * Stage where the resource is deployed
   */
  readonly stage: Stage;
  /**
   * Name of the project vinculated to the resource
   *
   * @default - 'devopsdays-app'
   */
  readonly project?: string;
  /**
   * Version of the project vinculated to the resource
   *
   * @default - 'latest'
   */
  readonly projectVersion?: string;
}

/**
 * CDK Aspect to apply some devopsdays default tags to all resources in the scope provided
 *
 * @example
 * import { Aspects } from 'aws-cdk-lib';
 * import { Stage } from 'devopsdays-cdk-lib/constants';
 *
 * Aspects.of(myStack).add(new Tagger({ stage: Stage.DEV, project: 'test', projectVersion: 'v1'}));
 */
class Tagger implements IAspect {
  private readonly stage: Stage;
  private readonly project: string;
  private readonly projectVersion: string;

  constructor(props: TaggerProps) {
    this.stage = props.stage;
    this.project = props.project ?? "devopsdays-app";
    this.projectVersion = props.projectVersion ?? "latest";
  }

  /**
   * Overload of the 'visit' method for the IAspect class, which is essentially the one defining the logic
   * we want to apply to our aspect.
   *
   * @param construct CDK construct that the aspect will apply our logic
   */
  visit(construct: IConstruct): void {
    const deployType = process.env.DEPLOY_TYPE
      ? process.env.DEPLOY_TYPE
      : "local";
    const stackName = Stack.of(construct).stackName;

    const cdkPackage = JSON.parse(fs.readFileSync("./package.json").toString());
    const cdkVersion =
      cdkPackage.dependencies !== undefined
        ? cdkPackage.dependencies["aws-cdk-lib"]
        : "local";

    const tags = {
      "devopsdays:env": this.stage,
      "devopsdays:deploy:tool": "cdk",
      "devopsdays:deploy:type": deployType,
      "devopsdays:deploy:tool:version": cdkVersion,
      "devopsdays:stack:name": stackName,
      "devopsdays:project:name": this.project,
      "devopsdays:project:version": this.projectVersion,
      "devopsdays:git:repository": Tagger.getGitRepository(),
    };

    for (const [tagName, tagValue] of Object.entries(tags)) {
      new Tag(tagName, tagValue).visit(construct);
    }
  }

  private static getGitRepository(): string {
    const data = this.getGitFileContent("config");
    for (const line of data.split("\n")) {
      if (line.includes("url = ")) {
        return line.trim().split(" ")[2];
      }
    }
    return "No code repo found";
  }

  private static getGitFileContent(fileName: string): string {
    const gitpath = this.findGitDirectory();
    if (!gitpath) {
      throw new Error("No .git folder found");
    }
    return fs.readFileSync(path.join(gitpath, fileName), "utf8");
  }

  private static findGitDirectory(): string {
    let currentDir = process.cwd(); // Get the current directory

    while (currentDir !== "/") {
      const gitDir = path.join(currentDir, ".git");

      if (fs.existsSync(gitDir)) {
        return gitDir;
      }

      currentDir = path.dirname(currentDir); // Move up to the parent directory
    }

    return ""; // .git directory not found
  }
}

export { Tagger, TaggerProps };

import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as route53Targets from "aws-cdk-lib/aws-route53-targets";
import * as cloudfrontOrigins from "aws-cdk-lib/aws-cloudfront-origins";

const rootDomain = "devopsdays.es";
const subDomain = "gallery";
const domainName = `${subDomain}.${rootDomain}`;

interface GalleryStackProps extends cdk.StackProps {
  cloudFrontCertificate: acm.ICertificate;
}

export class GalleryStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: GalleryStackProps) {
    super(scope, id, props);

    const bucketName = "devopsdays-gallery";

    const provider = new iam.CfnOIDCProvider(this, "GitHubIdentityProvider", {
      url: "https://token.actions.githubusercontent.com",
      clientIdList: ["sts.amazonaws.com"],
    });

    const cdkProvider = iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(
      this,
      "cdkGitHubProvider",
      provider.attrArn
    );

    const principal = new iam.OpenIdConnectPrincipal(cdkProvider, {
      StringLike: {
        "token.actions.githubusercontent.com:sub":
          "repo:devopsdays-es/devopsdays-caceres-gallery",
      },
    });

    new iam.Role(this, "GitHubGalleryDeployRole", {
      roleName: "GitHubGalleryDeployRole",
      description: "Role to deploy the gallery from GitHub Actions",
      assumedBy: principal,
      path: "/automation/github/",
      inlinePolicies: {
        DeployPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ["s3:ListBucket"],
              resources: [`arn:aws:s3:::${bucketName}`],
            }),
            new iam.PolicyStatement({
              actions: [
                "s3:PutObject",
                "s3:PutObjectAcl",
                "s3:GetObject",
                "s3:GetObjectAcl",
                "s3:DeleteObject",
                "s3:ListMultipartUploadParts",
                "s3:AbortMultipartUpload",
              ],
              resources: [`arn:aws:s3:::${bucketName}/*`],
            }),
          ],
        }),
      },
    });

    const bucket = new s3.Bucket(this, "GalleryBucket", {
      bucketName,
      blockPublicAccess: {
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false,
      },
      websiteIndexDocument: "index.html",
      websiteErrorDocument: "error.html",
      publicReadAccess: true,
    });

    const cdn = new cloudfront.Distribution(this, "GalleryDistribution", {
      comment: "DevopsDays Cáceres gallery distribution",
      priceClass: cloudfront.PriceClass.PRICE_CLASS_ALL,
      defaultBehavior: {
        compress: true,
        origin: new cloudfrontOrigins.S3StaticWebsiteOrigin(bucket),
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      domainNames: [domainName],
      certificate: props.cloudFrontCertificate,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
    });
    cdn.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);

    const zone = route53.HostedZone.fromLookup(this, "Zone", {
      domainName: rootDomain,
    });
    new route53.ARecord(this, "AliasRecord", {
      comment: "DevopsDays Cáceres gallery alias record",
      target: route53.RecordTarget.fromAlias(
        new route53Targets.CloudFrontTarget(cdn)
      ),
      zone,
      recordName: subDomain,
    });
  }
}

export class GalleryUsEast1Stack extends cdk.Stack {
  public cloudFrontCertificate: acm.ICertificate;

  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, {
      ...props,
      env: { account: props.env?.account, region: "us-east-1" },
    });

    const zone = route53.HostedZone.fromLookup(this, "Zone", {
      domainName: rootDomain,
    });

    this.cloudFrontCertificate = new acm.Certificate(this, "Certificate", {
      domainName,
      certificateName: domainName,
      validation: acm.CertificateValidation.fromDns(zone),
    });
  }
}

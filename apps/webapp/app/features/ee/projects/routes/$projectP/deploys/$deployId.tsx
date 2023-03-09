import { ArrowTopRightOnSquareIcon, StopIcon } from "@heroicons/react/20/solid";
import { Form, useRevalidator, useTransition } from "@remix-run/react";
import type { ActionArgs, LoaderArgs } from "@remix-run/server-runtime";
import classNames from "classnames";
import { useEffect } from "react";
import { typedjson, useTypedLoaderData } from "remix-typedjson";
import { useEventSource } from "remix-utils";
import { z } from "zod";
import { Panel } from "~/components/layout/Panel";
import {
  SecondaryButton,
  SecondaryLink,
  TertiaryLink,
} from "~/components/primitives/Buttons";
import { Spinner } from "~/components/primitives/Spinner";
import { Body } from "~/components/primitives/text/Body";
import { Header1 } from "~/components/primitives/text/Headers";
import { SubTitle } from "~/components/primitives/text/SubTitle";
import { DeploymentPresenter } from "~/features/ee/projects/presenters/deploymentPresenter.server";
import { deploymentStatusTitle } from "~/features/ee/projects/components/deploymentStatus";
import { CancelProjectDeployment } from "~/features/ee/projects/services/cancelProjectDeployment.server";
import { StopProjectDeployment } from "~/features/ee/projects/services/stopProjectDeployment.server";
import { IntlDate } from "~/components/IntlDate";
import { useCurrentProject } from "../../$projectP";

export async function loader({ request, params }: LoaderArgs) {
  const { projectP, organizationSlug, deployId } = z
    .object({
      projectP: z.string(),
      organizationSlug: z.string(),
      deployId: z.string(),
    })
    .parse(params);

  const presenter = new DeploymentPresenter();

  return typedjson(await presenter.data(organizationSlug, projectP, deployId));
}

export async function action({ request, params }: ActionArgs) {
  const { deployId } = z
    .object({
      deployId: z.string(),
    })
    .parse(params);

  const formPayload = Object.fromEntries(await request.formData());

  if (formPayload.action === "cancel") {
    const service = new CancelProjectDeployment();

    await service.call(deployId);
  }

  if (formPayload.action === "stop") {
    const service = new StopProjectDeployment();

    await service.call(deployId);
  }

  return { action: formPayload.action };
}

export default function DeploymentPage() {
  const project = useCurrentProject();
  const { deployment, logs } = useTypedLoaderData<typeof loader>();
  const transitionData = useTransition();

  const events = useEventSource(`/resources/deploys/${deployment.id}/stream`, {
    event: "update",
  });

  const revalidator = useRevalidator();

  useEffect(() => {
    if (events !== null) {
      revalidator.revalidate();
    }
    // WARNING Don't put the revalidator in the useEffect deps array or bad things will happen
  }, [events]); // eslint-disable-line react-hooks/exhaustive-deps

  const disabled = deployment.status !== "DEPLOYED";

  let action: "cancel" | "stop" | undefined;
  let actionConfirm: string | undefined;

  const actionLoading =
    (transitionData.state === "submitting" &&
      transitionData.type === "actionSubmission") ||
    (transitionData.state === "loading" &&
      transitionData.type === "actionReload");

  switch (deployment.status) {
    case "PENDING": {
      action = "cancel";
      actionConfirm = "Are you sure you want to cancel this deployment?";

      break;
    }
    case "BUILDING":
    case "DEPLOYED": {
      action = "stop";
      actionConfirm = "Are you sure you want to stop this deployment?";
      break;
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between">
        <Header1 className="mb-6">Deployment</Header1>
        <div className="flex gap-2">
          {action && (
            <Form
              method="post"
              onSubmit={(e) =>
                !confirm(actionConfirm ?? "Are you sure?") && e.preventDefault()
              }
            >
              <SecondaryButton
                disabled={actionLoading}
                type="submit"
                name="action"
                value={action}
              >
                {action === "stop" ? (
                  <>
                    {actionLoading ? (
                      <>
                        <Spinner className="-ml-1 h-3 w-3" />
                        Stopping deployment
                      </>
                    ) : (
                      <>
                        <StopIcon className="-ml-1 h-3 w-3 text-rose-500" />
                        Stop deployment
                      </>
                    )}
                  </>
                ) : (
                  <>
                    {actionLoading ? (
                      <>
                        <Spinner className="-ml-1 h-3 w-3" />
                        Cancelling deployment
                      </>
                    ) : (
                      <>
                        <StopIcon className="-ml-1 h-3 w-3" />
                        Cancel deployment
                      </>
                    )}
                  </>
                )}
              </SecondaryButton>
            </Form>
          )}

          <SecondaryLink
            to="#"
            className={classNames(
              disabled ? "pointer-events-none opacity-40" : ""
            )}
          >
            View Build Logs
          </SecondaryLink>
        </div>
      </div>
      <SubTitle>Deploy Summary</SubTitle>
      <Panel className="mb-6 !p-4">
        <ul className="mb-4 grid grid-cols-4">
          <li className={deploySummaryGridStyles}>
            <Body size="extra-small" className={deploySummaryLabelStyles}>
              Status
            </Body>
            <div className="flex items-center gap-2">
              {deployment.status === "DEPLOYING" ||
              deployment.status === "PENDING" ||
              deployment.status === "BUILDING" ? (
                <Spinner />
              ) : (
                <></>
              )}
              <Body className={deploySummaryValueStyles}>
                {deploymentStatusTitle(deployment.status)}
              </Body>
            </div>
          </li>
          <li className={deploySummaryGridStyles}>
            <Body size="extra-small" className={deploySummaryLabelStyles}>
              Started
            </Body>
            <Body className={deploySummaryValueStyles}>
              <IntlDate date={deployment.createdAt} />
            </Body>
          </li>
          <li className={deploySummaryGridStyles}>
            <Body size="extra-small" className={deploySummaryLabelStyles}>
              Environment
            </Body>
            <Body className={deploySummaryValueStyles}>Live</Body>
          </li>
          <li className={deploySummaryGridStyles}>
            <Body size="extra-small" className={deploySummaryLabelStyles}>
              Version
            </Body>
            <Body className={deploySummaryValueStyles}>
              {deployment.version}
            </Body>
          </li>
        </ul>
        <ul className="flex flex-col gap-4">
          <li className={deploySummaryGridStyles}>
            <Body size="extra-small" className={deploySummaryLabelStyles}>
              Commit
            </Body>
            <Body className={deploySummaryValueStyles}>
              <a
                href={`https://github.com/${project.name}/commit/${deployment.commitHash}`}
                target="_blank"
                className="flex items-center gap-1.5 transition hover:text-white"
              >
                {deployment.commitHash.slice(0, 12)}
                <span>
                  "{deployment.commitMessage}" by {deployment.committer}
                </span>
                <ArrowTopRightOnSquareIcon className="h-4 w-4" />
              </a>
            </Body>
          </li>
        </ul>
      </Panel>
      <div className="mb-2 flex items-center justify-between">
        <SubTitle className="mb-0">Deploy logs</SubTitle>
        <div className="flex items-center gap-4">
          {revalidator.state === "loading" && (
            <div className="flex items-center gap-1.5">
              <Spinner className="h-4 w-4" />
              <Body size="small" className="text-slate-400">
                Loading new logs…
              </Body>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500"></span>
            <Body size="small" className="text-slate-400">
              Live reloading
            </Body>
          </div>
        </div>
      </div>
      <div className="flex flex-auto overflow-auto rounded-md bg-slate-950 p-4">
        <pre className="grid max-h-[50px] w-full grid-cols-[repeat(3,_fit-content(800px))_1fr] items-start gap-y-3 gap-x-6 text-sm text-slate-300">
          {logs.map((log) => (
            <>
              <span>${log.createdAt.toTimeString()}</span>
              <span
                className={classNames(
                  log.level === "ERROR" ? "text-rose-500" : ""
                )}
              >
                ${log.level}
              </span>
              <span>${log.log}</span>
              <TertiaryLink
                to="#"
                className="sticky -right-4 justify-self-end bg-slate-950 px-3.5"
              >
                View run
              </TertiaryLink>
            </>
          ))}
        </pre>
      </div>
    </div>
  );
}

const deploySummaryGridStyles = "flex flex-col gap-1";
const deploySummaryLabelStyles = "uppercase text-slate-400 tracking-wide";
const deploySummaryValueStyles = "text-slate-300";
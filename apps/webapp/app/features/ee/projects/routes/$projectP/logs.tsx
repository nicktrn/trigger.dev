import { useRevalidator } from "@remix-run/react";
import type { LoaderArgs } from "@remix-run/server-runtime";
import { useEffect } from "react";
import { typedjson, useTypedLoaderData } from "remix-typedjson";
import { useEventSource } from "remix-utils";
import { z } from "zod";
import { Spinner } from "~/components/primitives/Spinner";
import { Body } from "~/components/primitives/text/Body";
import { Header1, Header4 } from "~/components/primitives/text/Headers";
import { useCurrentProject } from "../$projectP";
import { LogOutput } from "../../components/LogOutput";
import { ProjectLogsPresenter } from "../../presenters/projectLogsPresenter.server";

export async function loader({ params }: LoaderArgs) {
  const { projectP, organizationSlug } = z
    .object({ projectP: z.string(), organizationSlug: z.string() })
    .parse(params);

  const presenter = new ProjectLogsPresenter();

  return typedjson(await presenter.data(organizationSlug, projectP));
}

export default function ProjectLogsPage() {
  const project = useCurrentProject();

  const { logs, currentDeployment } = useTypedLoaderData<typeof loader>();

  if (!currentDeployment) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between">
          <Header1 className="mb-6">Logs</Header1>
        </div>
      </div>
    );
  }

  const events = useEventSource(
    `/resources/deploys/${currentDeployment.id}/stream`,
    {
      event: "update",
    }
  );

  const revalidator = useRevalidator();

  useEffect(() => {
    if (events !== null) {
      revalidator.revalidate();
    }
    // WARNING Don't put the revalidator in the useEffect deps array or bad things will happen
  }, [events]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between">
        <Header1 className="mb-6">Logs</Header1>

        <Header4>
          {currentDeployment.commitMessage} -{" "}
          {currentDeployment.commitHash.slice(0, 7)} -{" "}
          {currentDeployment.version}
        </Header4>
      </div>

      <div className="mb-2 flex items-center justify-between">
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
        <LogOutput logs={logs} />
      </div>
    </div>
  );
}
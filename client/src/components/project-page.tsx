import { Box, CircularProgress, Tab, Tabs } from '@mui/material';
import type { ComponentProps, ReactNode } from 'react';
import { useState } from 'react';
import type { TProject } from '../api/graphql.generated';
import { useProjectPageQuery } from '../api/graphql.generated';
import { isLoadedUrql } from '../api/urql';
import { useSearchParams } from '../utils/use-search-params';
import { NotFoundErrorDisplay } from './not-found-error-display';
import { PageModal } from './page-modal';
import { ProjectAvatar } from './project-avatar';
import { SourceIcon } from './source-icon';
import { UrqlErrorDisplay } from './urql-error-display';

type Props = {
  onClose: ComponentProps<typeof PageModal>['onClose'],
};

export const URL_KEY_PROJECT_PAGE = 'project';

export function ProjectPageModal(props: Props) {
  return (
    <PageModal onClose={props.onClose}>
      <ProjectPage />
    </PageModal>
  );
}

// TODO: add source, issues, wiki, discord, donation_urls?
// TODO: license

export function ProjectPage() {
  const id = useSearchParams().get(URL_KEY_PROJECT_PAGE) ?? '';

  const projectUrql = useProjectPageQuery({
    variables: {
      id,
    },
  });

  const [value, setValue] = useState(0);

  const handleChange = (event, newValue) => {
    setValue(newValue);
  };

  if (!isLoadedUrql(projectUrql)) {
    return <CircularProgress />;
  }

  if (projectUrql.error) {
    return <UrqlErrorDisplay urql={projectUrql} />;
  }

  const project = projectUrql.data.project;
  if (project == null) {
    return <NotFoundErrorDisplay />;
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <ProjectAvatar src={project.iconUrl} />
        <div>
          <h1>{project.name}</h1>
          <p>{project.description}</p>
        </div>
        <a href={project.homepage} target="_blank" style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }} >
          <SourceIcon source={project.source}/>
          <span>View on {project.source}</span>
        </a>
      </div>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }} className="full-bleed">
        <Tabs value={value} onChange={handleChange} aria-label="basic tabs example">
          <Tab label="Description" {...a11yProps(0)} />
          <Tab label="Files" {...a11yProps(1)} />
        </Tabs>

        <TabPanel activeTab={value} tab={0}>
          {() => <DescriptionPanel project={project} />}
        </TabPanel>

        <TabPanel activeTab={value} tab={1}>
          {() => <FilesPanel />}
        </TabPanel>
      </Box>
    </>
  );
}

function a11yProps(index: string | number) {
  return {
    id: `simple-tab-${index}`,
    'aria-controls': `simple-tabpanel-${index}`,
  };
}

type TabPanelProps = {
  children(): ReactNode,
  activeTab: string | number,
  tab: string | number,
};

function TabPanel(props: TabPanelProps) {
  const { children, activeTab, tab, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={activeTab !== tab}
      id={`simple-tabpanel-${tab}`}
      aria-labelledby={`simple-tab-${tab}`}
      {...other}
    >
      {activeTab === tab && <div style={{ padding: '16px' }}>{children()}</div>}
    </div>
  );
}

type DescriptionPanelProps = {
  project: Pick<TProject, 'source' | 'homepage' | 'longDescription'>,
};

function DescriptionPanel(props: DescriptionPanelProps) {
  const { project } = props;

  // TODO: use XML-to-JSX
  // TODO: redirect links to curseforge and modrinth projects
  //  - add endpoint to view project based on modrinth/curseforge ID or slug
  // TODO: external links use _target:blank
  // TODO: transforms urls like /linkout?remoteUrl=http%253a%252f%252fae-mod.info%252f
  // TODO: relative links should be relative to homepageUrl
  // TODO: max height on images
  // TODO: whitelist css
  return (
    <div dangerouslySetInnerHTML={{ __html: project.longDescription }} />
  );
}

type FilesPanelProps = {

};

function FilesPanel(props: FilesPanelProps) {

  return 'files';
}

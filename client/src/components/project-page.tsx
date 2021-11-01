import { Box, CircularProgress, List, ListItem, ListItemText, Tab, Tabs } from '@mui/material';
import type { ComponentProps, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { TProject } from '../api/graphql.generated';
import { useProjectPageJarsQuery, useProjectPageQuery } from '../api/graphql.generated';
import { isLoadedUrql } from '../api/urql';
import { modifySearch, useSearchParams } from '../utils/use-search-params';
import { NotFoundErrorDisplay } from './not-found-error-display';
import { PageModal } from './page-modal';
import { ProjectAvatar } from './project-avatar';
import { ProjectDescription } from './project-description';
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

const URL_KEY_PROJECT_PAGE_TAB = 'project-tab';

export function ProjectPage() {
  const search = useSearchParams();
  const id = search.get(URL_KEY_PROJECT_PAGE) ?? '';
  const activeTab = search.get(URL_KEY_PROJECT_PAGE_TAB) === 'files' ? 1 : 0;

  const projectUrql = useProjectPageQuery({
    variables: {
      id,
    },
  });

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
        <Tabs value={activeTab} aria-label="basic tabs example">
          <Tab
            label="Description"
            {...a11yProps(0)}
            // TODO: cancel navigation if already on page
            component={Link}
            to={{ search: modifySearch(search, { [URL_KEY_PROJECT_PAGE_TAB]: null }).toString() }}
          />
          <Tab
            label="Files"
            {...a11yProps(1)}
            // TODO: cancel navigation if already on page
            component={Link}
            to={{ search: modifySearch(search, { [URL_KEY_PROJECT_PAGE_TAB]: 'files' }).toString() }}
          />
        </Tabs>

        <TabPanel activeTab={activeTab} tab={0}>
          {() => <ProjectDescription project={project} />}
        </TabPanel>

        <TabPanel activeTab={activeTab} tab={1}>
          {() => <FilesPanel project={project} />}
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

type FilesPanelProps = {
  project: { id: TProject['id'] },
};

function FilesPanel(props: FilesPanelProps) {
  const filesUrql = useProjectPageJarsQuery({
    variables: {
      id: props.project.id,
    },
  });

  if (!isLoadedUrql(filesUrql)) {
    return <CircularProgress />;
  }

  if (filesUrql.error) {
    return <UrqlErrorDisplay urql={filesUrql} />;
  }

  const jars = filesUrql.data.jars.nodes;

  return (
    <List>
      {jars.map(jar => {
        return (
          <ListItem key={jar.id}>
            <ListItemText
              primary={jar.mods.map(mod => {
                return `${mod.name} (${mod.modId}) ${mod.modVersion} - MC ${mod.supportedMinecraftVersions.join(', ')}, ${mod.supportedModLoader}`;
              }).join(', ')}
              secondary={`${jar.releaseType} ${jar.fileName}`}
            />
          </ListItem>
        );
      })}
    </List>
  );
}

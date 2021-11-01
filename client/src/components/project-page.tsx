import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import type { ComponentProps, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { TProject } from '../api/graphql.generated';
import { useProjectPageJarsQuery, useProjectPageQuery } from '../api/graphql.generated';
import { isLoadedUrql } from '../api/urql';
import { modifySearch, useSearchParams } from '../utils/use-search-params';
import { URL_KEY_FILE_MODAL } from './jar-details-modal';
import { NotFoundErrorDisplay } from './not-found-error-display';
import { PageModal } from './page-modal';
import { ProjectAvatar } from './project-avatar';
import { ProjectDescription } from './project-description';
import { SourceIcon } from './source-icon';
import { UrqlErrorDisplay } from './urql-error-display';

type Props = {
  onClose: ComponentProps<typeof PageModal>['onClose'],
} & ProjectPageProps;

export const URL_KEY_PROJECT_PAGE = 'project';

export function ProjectPageModal(props: Props) {
  return (
    <PageModal onClose={props.onClose}>
      <ProjectPage projectId={props.projectId} />
    </PageModal>
  );
}

// TODO: add source, issues, wiki, discord, donation_urls?
// TODO: license

const URL_KEY_PROJECT_PAGE_TAB = 'project-tab';

type ProjectPageProps = {
  projectId: string,
};

export function ProjectPage(props: ProjectPageProps) {
  const search = useSearchParams();
  const id = props.projectId;
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

// TODO: when viewed from modpack, set default filters to match modpack (clearable)
function FilesPanel(props: FilesPanelProps) {
  const search = useSearchParams();
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
          <ListItem
            key={jar.id}
            disablePadding
          >
            <ListItemButton
              component={Link}
              to={{ search: modifySearch(search, { [URL_KEY_FILE_MODAL]: jar.id }).toString() }}
            >
              <ListItemText
                primary={jar.mods.map(mod => {
                  return `${mod.name} (${mod.modId}) ${mod.modVersion} - MC ${mod.supportedMinecraftVersions.join(', ')}, ${mod.supportedModLoader}`;
                }).join(', ')}
                secondary={`${jar.releaseType} ${jar.fileName}`}
              />
            </ListItemButton>
          </ListItem>
        );
      })}
    </List>
  );
}

import { EMPTY_ARRAY } from '@ephys/fox-forge';
import AddIcon from '@mui/icons-material/Add';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Pagination from '@mui/material/Pagination';
import PaginationItem from '@mui/material/PaginationItem';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import type { ComponentProps, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { TProject } from '../api/graphql.generated';
import { useProjectPageJarsQuery, useProjectPageQuery } from '../api/graphql.generated';
import { isLoadedUrql } from '../api/urql';
import { jarInModpack, modsInModpack, useAddJarToModpack } from '../utils/modpack-utils.js';
import { modifySearch, useSearchParams } from '../utils/use-search-params';
import { Chips } from './chips';
import { useCurrentModpack } from './current-modpack-provider.js';
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
      <ProjectPage projectId={props.projectId} fileBaseFilters={props.fileBaseFilters} />
    </PageModal>
  );
}

// TODO: add source, issues, wiki, discord, donation_urls?
// TODO: license

const URL_KEY_PROJECT_PAGE_TAB = 'project-tab';

type ProjectPageProps = {
  projectId: string,
  fileBaseFilters?: string[],
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

      <Box className="full-bleed">
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
          {() => <FilesPanel project={project} baseFilters={props.fileBaseFilters} />}
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
  baseFilters?: string[],
};

// TODO: when viewed from modpack, set default filters to match modpack (clearable)
function FilesPanel(props: FilesPanelProps) {
  const baseFilters: readonly string[] = props.baseFilters ?? EMPTY_ARRAY;
  const search = useSearchParams();
  const page = Math.max(Number(search.get('page') || 1), 1);

  const elementsPerPage = 20;
  const filesUrql = useProjectPageJarsQuery({
    variables: {
      id: props.project.id,
      limit: elementsPerPage,
      offset: (page - 1) * elementsPerPage,
      query: baseFilters.join(' '),
    },
  });

  const currentModpack = useCurrentModpack();
  const [addJarToModpack] = useAddJarToModpack();

  if (!isLoadedUrql(filesUrql)) {
    return <CircularProgress />;
  }

  if (filesUrql.error) {
    return <UrqlErrorDisplay urql={filesUrql} />;
  }

  const jars = filesUrql.data.jars.nodes;
  const matchingCount = filesUrql.data.jars.totalCount;
  const pageCount = Math.ceil(matchingCount / elementsPerPage);

  // TODO: display compatibility warning if file does not explicitely support modpack's minecraft version

  return (
    <>
      {baseFilters.length > 0 && (
        <div style={{ display: 'flex' }}>
          <Chips>
            {baseFilters.map((filter, i) => <Chip key={i} label={filter} />)}
          </Chips>
          {matchingCount} matching files
        </div>
      )}
      <List>
        {jars.map(jar => {
          const jarMods = jar.mods.map(mod => mod.modId);

          return (
            <ListItem
              key={jar.id}
              disablePadding
              secondaryAction={!currentModpack ? (
                null
              ) : jarInModpack(currentModpack, jar.id) ? (
                <Chip label="Installed" />
              ) : modsInModpack(currentModpack, jarMods) ? (
                <Button onClick={async () => alert('nyi')}>
                  <AddIcon /> Replace with this version
                </Button>
              ) : (
                <Button onClick={async () => addJarToModpack(jar.id)}>
                  <AddIcon /> Add to modpack
                </Button>
              )}
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
      <Pagination
        count={pageCount}
        page={Math.min(page, pageCount)}
        renderItem={item => (
          <PaginationItem
            component={Link}
            to={{
              search: modifySearch(search, {
                page: item.page,
              }).toString(),
            }}
            {...item}
          />
        )}
      />
    </>
  );
}

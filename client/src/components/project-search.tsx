import {
  Avatar,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemAvatar, ListItemButton,
  ListItemText,
  MenuItem,
  Pagination,
  PaginationItem,
  Select,
  TextField,
} from '@mui/material';
import type { ComponentProps } from 'react';
import { useCallback, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { Link, useHistory } from 'react-router-dom';
import { EMPTY_ARRAY, EMPTY_OBJECT } from '../../../common/utils';
import {
  ProjectSearchSortOrder,
  ProjectSearchSortOrderDirection,
  ProjectSource,
  useProjectSearchQuery,
} from '../api/graphql.generated';
import { isLoadedUrql } from '../api/urql';
import useDebounce from '../utils/use-debounce';
import { modifySearch, useSearchParams } from '../utils/use-search-params';
import { LinearProgress } from './linear-progress';
import { PageModal, usePageModalContext } from './page-modal';
import { UrqlErrorDisplay } from './urql-error-display';

type Props = {
  onClose: ComponentProps<typeof PageModal>['onClose'],
} & Pick<ProjectSearchProps, 'baseFilters'>;

export function ProjectSearchModal(props: Props) {
  return (
    <PageModal onClose={props.onClose}>
      <ProjectSearch baseFilters={props.baseFilters}/>
    </PageModal>
  );
}

type ProjectSearchProps = {
  baseFilters?: string[],
};

const URL_KEY_ORDER = 'o';
const URL_KEY_QUERY = 'q';
export const URL_KEY_MOD_LIBRARY_PAGE = 'mod-library';

export function ProjectSearch(props: ProjectSearchProps) {
  const { baseFilters = EMPTY_ARRAY } = props;
  const search = useSearchParams();
  const history = useHistory();
  const page = Math.max(Number(search.get(URL_KEY_MOD_LIBRARY_PAGE) || 1), 1);

  // @ts-expect-error
  const sortOrder = ProjectSearchSortOrder[search.get(URL_KEY_ORDER)] ?? ProjectSearchSortOrder.FirstFileUpload;

  const onSortOrderChange = useCallback(e => {
    history.replace({
      search: modifySearch(search, {
        [URL_KEY_ORDER]: e.target.value,
        [URL_KEY_MOD_LIBRARY_PAGE]: 1, // TODO: go back in history until all pages are removed
      }).toString(),
    });
  }, [history, search]);

  const userQuery = search.get(URL_KEY_QUERY) ?? '';
  const onUserQueryChange = useCallback(e => {
    history.replace({
      search: modifySearch(search, {
        [URL_KEY_QUERY]: e.target.value,
        [URL_KEY_MOD_LIBRARY_PAGE]: 1, // TODO: go back in history until all pages are removed
      }).toString(),
    });
  }, []);
  const userQueryDebounced = useDebounce(userQuery, 150);

  const elementsPerPage = 20;
  const searchUrql = useProjectSearchQuery({
    variables: {
      query: `${userQueryDebounced} ${baseFilters.join(' ')}`,
      offset: elementsPerPage * (page - 1),
      limit: elementsPerPage,
      order: sortOrder,
      orderDir: sortOrder === ProjectSearchSortOrder.ProjectName
        ? ProjectSearchSortOrderDirection.Asc
        : ProjectSearchSortOrderDirection.Desc,
    },
  });

  const pageCount = searchUrql.data
    ? Math.ceil((searchUrql.data.projects.totalCount ?? 0) / elementsPerPage)
  : null;

  const modalContext = usePageModalContext();
  useEffect(modalContext.resetScroll, [page, sortOrder]);
  const intl = useIntl();

  return (
    <>
      {searchUrql.fetching && (
        <LinearProgress />
      )}
      <h1 style={{ marginTop: '16px' }}>Mod Projects</h1>
      <div style={{ display: 'flex' }}>
        <TextField label="Search" name="query" style={{ width: '100%' }} onChange={onUserQueryChange} defaultValue={userQuery}/>
        <FormControl fullWidth>
          <InputLabel id="search-sort-order">Sort order</InputLabel>
          <Select
            name="sort-order"
            labelId="search-sort-order"
            value={sortOrder}
            label="Sort order"
            onChange={onSortOrderChange}
          >
            <MenuItem value={ProjectSearchSortOrder.ProjectName}>Alphabetical</MenuItem>
            <MenuItem value={ProjectSearchSortOrder.FirstFileUpload}>First compatible upload</MenuItem>
            <MenuItem value={ProjectSearchSortOrder.LastFileUpload}>Last update</MenuItem>
          </Select>
        </FormControl>
      </div>
      <div>
        {baseFilters.map((filter, i) => <Chip key={i} label={filter} />)}
        {searchUrql.data && `${searchUrql.data.projects.totalCount} compatible mods`}
      </div>
      {!isLoadedUrql(searchUrql) ? (
        <CircularProgress />
      ) : searchUrql.error ? (
        <UrqlErrorDisplay urql={searchUrql} />
      ) : (
        <>
          {/* TODO: on hover: view quick actions (view files / add to modpack, view curse/modrinth page) */}
          {/* TODO: add "hide this mod" action */}
          {/* TODO: open project in new page */}
          <List>
            {searchUrql.data.projects.edges.map(edge => {
              const project = edge.node;

              const { firstFileUploadedAt, lastFileUploadedAt } = decodeCursor(edge.cursor);

              return (
                <ListItem key={project.id} disablePadding>
                  <ListItemButton component="a" href={project.homepage} target="_blank">
                    <ListItemAvatar sx={{ marginRight: '16px' }}>
                      <Avatar variant="square" alt="" src={project.iconUrl} sx={{ width: 96, height: 96 }} />
                    </ListItemAvatar>
                    <ListItemText
                      primary={project.name}
                      secondary={(
                        <>
                          {project.description}
                          {firstFileUploadedAt && (
                            <>
                              <br />
                              Compatible since {intl.formatDate(firstFileUploadedAt, { dateStyle: 'medium', timeStyle: 'medium' })}
                            </>
                          )}
                          {lastFileUploadedAt && (
                            <>
                              <br />
                              Last update on {intl.formatDate(lastFileUploadedAt, { dateStyle: 'medium', timeStyle: 'medium' })}
                            </>
                          )}
                        </>
                      )}
                    />

                    {project.source === ProjectSource.Curseforge ? (
                      <img src="/curse.svg" height="32" />
                    ) : (
                      <img src="/modrinth.svg" height="32" width="32" />
                    )}
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
          <Pagination
            count={pageCount!}
            page={Math.min(page, pageCount!)}
            renderItem={item => (
              <PaginationItem
                component={Link}
                to={{
                  search: modifySearch(search, {
                    [URL_KEY_MOD_LIBRARY_PAGE]: item.page,
                  }).toString(),
                }}
                {...item}
              />
            )}
          />
        </>
      )}
    </>
  );
}

function decodeCursor(cursor: string) {
  try {
    // should really not be doing this, cursor are opaque and could be anything
    return JSON.parse(atob(cursor));
  } catch (e) {
    return EMPTY_OBJECT;
  }
}

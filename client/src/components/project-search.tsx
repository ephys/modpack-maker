import {
  Avatar,
  Box,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel, LinearProgress,
  List,
  ListItem,
  ListItemAvatar, ListItemButton,
  ListItemText,
  MenuItem,
  Modal,
  Pagination,
  PaginationItem,
  Select,
  TextField,
} from '@mui/material';
import type { ComponentProps } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useHistory } from 'react-router-dom';
import { EMPTY_ARRAY } from '../../../common/utils';
import {
  ProjectSearchSortOrder,
  ProjectSearchSortOrderDirection,
  ProjectSource,
  useProjectSearchQuery,
} from '../api/graphql.generated';
import { isLoadedUrql } from '../api/urql';
import useDebounce from '../utils/use-debounce';
import { modifySearch, useSearchParams } from '../utils/use-search-params';
import css from './project-search.module.scss';
import { UrqlErrorDisplay } from './urql-error-display';

type Props = {
  onClose: ComponentProps<typeof Modal>['onClose'],
} & Pick<ProjectSearchProps, 'baseFilters'>;

export function ProjectSearchModal(props: Props) {
  const modalRef = useRef<HTMLDivElement | null>(null);

  const onPageChange = useCallback(() => {
    modalRef.current?.scrollTo({
      top: 0,
    });
  }, []);

  return (
    <Modal open className={css.modal} onClose={props.onClose}>
      <Box className={css.modalBox} ref={modalRef}>
        <ProjectSearch baseFilters={props.baseFilters} onPageChange={onPageChange}/>
      </Box>
    </Modal>
  );
}

type ProjectSearchProps = {
  baseFilters?: string[],
  onPageChange?(): any,
};

const URL_KEY_ORDER = 'o';
const URL_KEY_QUERY = 'q';
const URL_KEY_MOD_LIBRARY_PAGE = 'mod-library';

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

  useEffect(() => {
    props.onPageChange?.();
  }, [page, sortOrder]);

  const pageCount = searchUrql.data
    ? Math.ceil((searchUrql.data.projects.totalCount ?? 0) / elementsPerPage)
  : null;

  return (
    <div className={css.projectSearch}>
      <h1>Mod Projects</h1>
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
      {baseFilters.map((filter, i) => <Chip key={i} label={filter} />)}
      {searchUrql.data && `${searchUrql.data.projects.totalCount} compatible mods`}
      {!isLoadedUrql(searchUrql) ? (
        <CircularProgress />
      ) : searchUrql.error ? (
        <UrqlErrorDisplay urql={searchUrql} />
      ) : (
        <>
          {/* TODO: on hover: view quick actions (view files / add to modpack, view curse/modrinth page) */}
          {/* TODO: add "hide this mod" action */}
          {/* TODO: open project in new page */}
          {searchUrql.fetching && (
            <LinearProgress />
          )}
          <List>
            {searchUrql.data.projects.nodes.map(project => (
              <ListItem key={project.id} disablePadding>
                <ListItemButton component="a" href={project.homepage} target="_blank">
                  <ListItemAvatar sx={{ marginRight: '16px' }}>
                    <Avatar variant="square" alt="" src={project.iconUrl} sx={{ width: 96, height: 96 }} />
                  </ListItemAvatar>
                  <ListItemText primary={project.name} secondary={project.description}/>

                  {project.source === ProjectSource.Curseforge ? (
                    <img src="/curse.svg" height="32"/>
                  ) : (
                    <img src="/modrinth.svg" height="32" width="32"/>
                  )}
                </ListItemButton>
              </ListItem>
            ))}
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
    </div>
  );
}

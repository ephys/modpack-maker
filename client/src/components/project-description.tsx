import classNames from 'classnames';
import type { TProject } from '../api/graphql.generated';
import css from './project-description.module.scss';

type Props = {
  project: Pick<TProject, 'source' | 'homepage' | 'longDescription'>,
};

export function ProjectDescription(props: Props) {
  const { project } = props;

  // TODO: use XML-to-JSX
  // TODO: redirect links to curseforge and modrinth projects
  //  - add endpoint to view project based on modrinth/curseforge ID or slug
  // TODO: external links use _target:blank
  // TODO: transforms urls like /linkout?remoteUrl=http%253a%252f%252fae-mod.info%252f
  // TODO: relative links should be relative to homepageUrl
  // TODO: max height on images
  // TODO: whitelist css
  // TODO: remove titles whose content.trim().length = 0
  return (
    <div className={classNames(css.projectDescription, css[project.source.toLowerCase()])}>
      <div dangerouslySetInnerHTML={{ __html: project.longDescription }} />
    </div>
  );
}

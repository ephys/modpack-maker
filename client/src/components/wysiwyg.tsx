import type { OverridableComponent } from '@mui/material/OverridableComponent';
import classnames from 'classnames';
import type { ComponentProps } from 'react';
import { AnyLink } from './any-link';
import css from './wysiwyg.module.scss';

const Anchor: OverridableComponent<{
  props: {},
  defaultComponent: typeof AnyLink,
  classKey: '',
}> = props => {
  const { component: Component = AnyLink, ...passDown } = props;

  return (
    <Component {...passDown} className={classnames(props.className, css.anchor)} />
  );
};

export { Anchor };

/**
 * A button rendered like a link.
 * It is typically a bad idea to use this component.
 *
 * Not to be mistaken with {@see LinkButton}, which is an anchor rendered as a Button
 */
export function ButtonAnchor(props: ComponentProps<'button'>) {
  return (
    <button type="button" {...props} className={classnames(props.className, css.anchor)} />
  );
}

export function CodeSpan(props: ComponentProps<'code'>) {
  return <code {...props} className={classnames(props.className, css.codeSpan)} />;
}

export function CodeBlock(props: ComponentProps<'pre'>) {
  return (
    <pre {...props} className={classnames(props.className, css.codeBlock)}>
      <code className={css.codeSpan}>{props.children}</code>
    </pre>
  );
}

export function Title1(props: ComponentProps<'h1'>) {
  return <h1 {...props} className={classnames(props.className, css.title1)} />;
}

export function Title2(props: ComponentProps<'h2'>) {
  return <h2 {...props} className={classnames(props.className, css.title2)} />;
}

export function Title3(props: ComponentProps<'h3'>) {
  return <h3 {...props} className={classnames(props.className, css.title3)} />;
}

export function Text(props: ComponentProps<'p'>) {
  return <p {...props} className={classnames(props.className, css.text)} />;
}

import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import IconButton from '@material-ui/core/IconButton';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import css from './action-menu.module.scss';
import { ComponentProps, isValidElement, useState } from 'react';
import { AnyLink } from './any-link';

export type TAction = {
  key: string | number,
  icon?: React.ReactElement | React.ComponentType,
  title: string,
  onClick?: (e: React.SyntheticEvent<HTMLButtonElement>) => void,
  href?: string,
};

type TActionMenuProps = {
  actions: TAction[],
  onRequestClose?: () => void,
  anchorEl: HTMLElement | null,
};

export function ActionMenu(props: TActionMenuProps) {
  const { actions, onRequestClose, anchorEl, ...passDown } = props;

  return (
    <Menu
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={props.onRequestClose}
      {...passDown}
    >
      {actions.map((action, i) => {

        let icon = action.icon;
        if (icon != null && !isValidElement(icon)) {
          const IconComp = icon;
          icon = <IconComp />;
        }

        return (
          <MenuItem
            className={css.menuItem}
            component={action.href ? MenuItemLink : MenuItemButton}
            href={action.href}
            key={action.key || i}
            onClick={e => {
              action.onClick && action.onClick(e);
              onRequestClose();
            }}
          >
            {icon && <span className={css.actionIcon}>{icon}</span>}
            {action.title}
          </MenuItem>
        );
      })}
    </Menu>
  );
}

function MenuItemButton(props: ComponentProps<'button'>) {
  return (
    <li>
      <button {...props} />
    </li>
  );
}

function MenuItemLink(props: ComponentProps<typeof AnyLink>) {
  return (
    <li>
      <AnyLink {...props} />
    </li>
  );
}

type TMoreMenuProps = {
  actions: TAction[],
  className?: string,
  htmlColor?: string,
};

export function MoreMenu(props: TMoreMenuProps) {
  const [moreMenu, setMoreMenu] = useState(null);

  function closeMoreMenu() {
    setMoreMenu(null);
  }

  function openMoreMenu(event) {
    setMoreMenu(event.currentTarget);
  }

  return (
    <>
      <IconButton
        aria-haspopup="true"
        onClick={openMoreMenu}
        className={props.className}
        title="Open Menu"
      >
        <MoreVertIcon color="inherit" htmlColor={props.htmlColor} />
      </IconButton>
      <ActionMenu actions={props.actions} onRequestClose={closeMoreMenu} anchorEl={moreMenu} />
    </>
  );
}

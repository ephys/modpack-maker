import UploadIcon from '@mui/icons-material/CloudUploadOutlined';
import classnames from 'classnames';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { MaybePromise } from '../utils/typing.js';
import css from './dropzone.module.scss';

type Props = {
  children: ReactNode,
  className?: string,
  itemFilter(list: DataTransferItemList): MaybePromise<any[]>,
  onDrop(data: { items: any[] }): void,
};

export default function DropZone(props: Props) {
  const { itemFilter, onDrop: parentOnDrop } = props;
  const [isDropping, setIsDropping] = useState(false);
  const ref = useRef<HTMLDivElement>();

  useEffect(() => {
    const div = ref.current;

    const onEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDropping(true);
    };

    const onLeave = e => {
      e.preventDefault();
      e.stopPropagation();

      setIsDropping(false);
    };

    const onDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDropping(false);

      const items = await itemFilter(e.dataTransfer.items);

      if (items.length > 0) {
        return parentOnDrop({ items });
      }
    };

    div.addEventListener('dragenter', onEnter);
    div.addEventListener('dragleave', onLeave);
    div.addEventListener('dragover', onEnter);
    div.addEventListener('drop', onDrop);

    return () => {
      div.removeEventListener('dragenter', onEnter);
      div.removeEventListener('dragleave', onLeave);
      div.removeEventListener('dragover', onEnter);
      div.removeEventListener('drop', onDrop);
    };
  }, [itemFilter, parentOnDrop]);

  return (
    <div className={classnames(css.dropZone, props.className)} ref={ref}>
      {props.children}
      {isDropping && (
        <div className={css.dropActive}>
          <div className={css.dropActiveContent}>
            <UploadIcon fontSize="inherit" />
            <p>Drop Here</p>
          </div>
        </div>
      )}
    </div>
  );
}

async function getDroppedItems(dataTransferItems: DataTransferItemList) {

  return Promise.all(Array.from(dataTransferItems).map(async item => {
    return {
      kind: item.kind,
      type: item.type,
      value: await getAsStringAsync(item),
    };
  }));
}

export async function getAsStringAsync(item): Promise<string> {
  return new Promise<string>(resolve => item.getAsString(resolve));
}

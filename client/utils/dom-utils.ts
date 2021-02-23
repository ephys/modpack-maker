export function getFormValue(e: HTMLFormElement, fieldName: string): number | string | null | Array<number | string> {
  // @ts-ignore
  return getFormElementValue(e.elements[fieldName]);
}

// TODO: test me once RadioNodeList is available https://github.com/jsdom/jsdom/issues/2600
export function getFormValues(form: HTMLFormElement): {
  [key: string]: number | string | null | Array<number | string>
} {

  const out = Object.create(null);

  for (const element of form.elements) {
    // @ts-ignore
    const name = element.name;

    // some .elements don't contain any data (eg. buttons)
    if (!name) {
      continue;
    }

    // .namedItems returns an array when two elements have the same key
    // so no need to process them twice
    if (out[name]) {
      continue;
    }

    out[name] = getFormElementValue(form.elements.namedItem(name));
  }

  return out;
}

export function getFormElementValue(
  element: Element | RadioNodeList,
): string | number | null | boolean | Array<string | number> {
  if (isRadioNodeList(element)) {
    return getRadioNodeListValue(element);
  }

  // @ts-ignore
  const elementGroup = element.form && element.name ? element.form.elements[element.name] : null;
  if (elementGroup && isRadioNodeList(elementGroup)) {
    return getRadioNodeListValue(elementGroup);
  }

  return getSingleFormElementValue(element);
}

function getSingleFormElementValue(element: Node): string | number | boolean {
  if (isHtmlInput(element)) {
    // a checkbox will either be returned as its checked state (if .value is empty, boolean) - this is the "Switch" use case
    // or as its value (if not empty) - this is the multiple checkboxes use case
    if (element.type === 'checkbox') {
      if (element.value === '') {
        return element.checked;
      }

      return element.checked ? element.value : '';
    }

    if (element.type === 'number') {
      if (Number.isNaN(element.valueAsNumber)) {
        return null;
      }

      return element.valueAsNumber;
    }

    return element.value;
  }

  if (isHtmlSelect(element) || isHtmlTextarea(element)) {
    return element.value;
  }

  throw new Error(`Unsupported element type ${element.nodeName}`);
}

function getRadioNodeListValue(radioList: RadioNodeList): string | string[] {
  // RadioNodeList of input[type="radio"]
  if (radioList.value) {
    return radioList.value;
  }

  const firstElement = radioList.item(0);
  if (isHtmlInput(firstElement) && firstElement.type === 'radio') {
    return '';
  }

  // RadioNodeList of input[type="checkbox"]
  const values = [];
  for (const checkbox of radioList) {
    const value = getSingleFormElementValue(checkbox);
    if (value) {
      values.push(value);
    }
  }

  return values;
}

export function isHtmlInput(item: any): item is HTMLInputElement {
  return item.nodeName === 'INPUT';
}

export function isHtmlTextarea(item: any): item is HTMLTextAreaElement {
  return item.nodeName === 'TEXTAREA';
}

export function isHtmlSelect(item: any): item is HTMLTextAreaElement {
  return item.nodeName === 'SELECT';
}

export function isRadioNodeList(item: any): item is RadioNodeList {
  return item instanceof RadioNodeList;
}

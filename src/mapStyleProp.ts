import { MappedNode, StyleRecord } from './types';
import { pipe } from 'fp-ts/lib/function';

export const mapStyleProp = (node: MappedNode) => {
  if (!node?.props?.style) {
    return node;
  }

  const style = pipe(
    node.props.style,
    mergeStyles,
    handleTransformStyle,
    convertToKebabCase,
    convertToPx,
    convertToInlineStyle
  );

  return {
    ...node,
    props: {
      ...node.props,
      style: style,
    },
  };
};
export const convertToInlineStyle = (style: StyleRecord): string => {
  return Object.entries(style)
    .map(([key, value]) => `${key}: ${value}`)
    .join('; ');
};

export const convertToPx = (style: StyleRecord): StyleRecord => {
  return Object.entries(style).reduce((acc, [key, value]) => {
    const isString = typeof value === 'string';
    const isFlex = key === 'flex';
    if (isString || isFlex) {
      acc[key] = value;
      return acc;
    }

    acc[key] = `${value}px`;
    return acc;
  }, {} as StyleRecord);
};
export function convertToKebabCase(style: StyleRecord): StyleRecord {
  const kebabObj: StyleRecord = {};
  for (const key in style) {
    if (style.hasOwnProperty(key)) {
      const kebabKey = key.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
      kebabObj[kebabKey] = style[key];
    }
  }
  return kebabObj;
}

// onStyleValues we may have  style: [{ flex: 1 }, null], we should filter and merge all the styles
type StyleRecordRaw =
  | Array<null | undefined | StyleRecord | Array<StyleRecord>>
  | StyleRecord;

const mergeStyles = (style: StyleRecordRaw): StyleRecord => {
  if (Array.isArray(style)) {
    if (style.length === 0) {
      return {};
    }

    const styles = style.filter((v): v is StyleRecord | Array<StyleRecord> =>
      Boolean(v)
    );

    return styles.reduce((acc: StyleRecord, curr) => {
      if (Array.isArray(curr)) {
        const merged = mergeStyles(curr);
        return { ...acc, ...merged };
      }

      return { ...acc, ...curr };
    }, {});
  }

  return style;
};

if (import.meta.vitest) {
  describe('Merge Styles', () => {
    test('Base', () => {
      expect(mergeStyles([])).toEqual({});
    });
    test('Merge styles', () => {
      expect(mergeStyles([{ flex: 1 }, { flex: 2 }])).toEqual({ flex: 2 });
    });
    test('Merge styles with null', () => {
      expect(mergeStyles([{ flex: 1 }, null, { flex: 2 }])).toEqual({
        flex: 2,
      });
    });
    test('Merge nested arrays of styles', () => {
      const some = mergeStyles([
        { flex: 1, overflow: 'hidden' },
        [
          {
            backgroundColor: 'rgb(242, 242, 242)',
          },
          { backgroundColor: 'white' },
        ],
      ]);

      expect(some).toEqual({
        backgroundColor: 'white',
        flex: 1,
        overflow: 'hidden',
      });
    });
  });
}

type TransformStyle = Record<
  string,
  string | number | Array<Record<string, number | string>>
>;
const handleTransformStyle = (style: TransformStyle) => {
  const assertIsTransform = (
    key: string,
    value: any
  ): value is Array<Record<string, any>> => {
    return key === 'transform' && Array.isArray(value);
  };

  return Object.entries(style).reduce((acc, [key, objectTransformValues]) => {
    if (assertIsTransform(key, objectTransformValues)) {
      const transformValue = objectTransformValues.map(convertToPx);
      const transformString = transformValue
        .map((transform: StyleRecord) =>
          Object.entries(transform)
            .map(
              ([transformKey, transformValue]) =>
                `${transformKey}(${transformValue})`
            )
            .join(' ')
        )
        .join(' ');
      return {
        ...acc,
        transform: transformString,
      };
    }
    return { ...acc, [key]: objectTransformValues };
  }, {} as StyleRecord);
};

if (import.meta.vitest) {
  describe('Transform Style', () => {
    test('Output transform string with units', () => {
      expect(
        handleTransformStyle({
          transform: [{ translateX: 10 }, { translateY: '10%' }],
        })
      ).toEqual({
        transform: 'translateX(10px) translateY(10%)',
      });
    });
    test('Inputs without transform', () => {
      expect(
        handleTransformStyle({
          color: 'red',
          backgroundColor: '#00f',
          fontSize: 32,
        })
      ).toEqual({ color: 'red', backgroundColor: '#00f', fontSize: 32 });
    });
  });
}

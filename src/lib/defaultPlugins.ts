import { NodeType, Schema } from 'prosemirror-model';
import { Plugin } from 'prosemirror-state';
import { keymap } from 'prosemirror-keymap';
import { toggleMark, baseKeymap } from 'prosemirror-commands';
import { splitListItem, liftListItem, sinkListItem } from 'prosemirror-schema-list';
import { history, undo, redo } from 'prosemirror-history';
import {
  inputRules, wrappingInputRule, textblockTypeInputRule,
  smartQuotes, emDash, ellipsis, InputRule
} from 'prosemirror-inputrules';

interface Options {
  history: boolean;
  keyboardShortcuts: boolean;
  inputRules: boolean;
}

interface ShortcutOptions {
  history: boolean;
}

const isMacOs = /Mac/.test(navigator.platform);

// Input rules ref: https://github.com/ProseMirror/prosemirror-example-setup/

// : (NodeType) → InputRule
// Given a blockquote node type, returns an input rule that turns `"> "`
// at the start of a textblock into a blockquote.
const blockQuoteRule = (nodeType: NodeType): InputRule => {
  return wrappingInputRule(/^\s*>\s$/, nodeType);
};

// : (NodeType) → InputRule
// Given a list node type, returns an input rule that turns a number
// followed by a dot at the start of a textblock into an ordered list.
const orderedListRule = (nodeType: NodeType): InputRule => {
  return wrappingInputRule(
    /^(\d+)\.\s$/,
    nodeType,
    match => ({ order: +match[1] }),
    (match, node) => node.childCount + node.attrs.order === +match[1]
  );
};

// : (NodeType) → InputRule
// Given a list node type, returns an input rule that turns a bullet
// (dash, plush, or asterisk) at the start of a textblock into a
// bullet list.
const bulletListRule = (nodeType: NodeType): InputRule => {
  return wrappingInputRule(/^\s*([-+*])\s$/, nodeType);
};

// : (NodeType) → InputRule
// Given a code block node type, returns an input rule that turns a
// textblock starting with three backticks into a code block.
const codeBlockRule = (nodeType: NodeType): InputRule => {
  return textblockTypeInputRule(/^```$/, nodeType);
};

// : (NodeType, number) → InputRule
// Given a node type and a maximum level, creates an input rule that
// turns up to that number of `#` characters followed by a space at
// the start of a textblock into a heading whose level corresponds to
// the number of `#` signs.
const headingRule = (nodeType: NodeType, maxLevel: number): InputRule => {
  return textblockTypeInputRule(
    new RegExp('^(#{1,' + maxLevel + '})\\s$'),
    nodeType,
    (match) => ({ level: match[1].length })
  );
};

// : (Schema) → Plugin
// A set of input rules for creating the basic block quotes, lists,
// code blocks, and heading.
const buildInputRules = (schema: Schema): Plugin => {
  const rules = smartQuotes.concat(ellipsis, emDash);

  rules.push(blockQuoteRule(schema.nodes.blockquote));
  rules.push(orderedListRule(schema.nodes.ordered_list));
  rules.push(bulletListRule(schema.nodes.bullet_list));
  rules.push(codeBlockRule(schema.nodes.code_block));
  rules.push(headingRule(schema.nodes.heading, 6));

  return inputRules({ rules });
};

const getKeyboardShortcuts = (schema: Schema, options: ShortcutOptions) => {
  const historyKeyMap: Record<string, any> = {};

  historyKeyMap['Mod-z'] = undo;
  if (isMacOs) {
    historyKeyMap['Shift-Mod-z'] = redo;
  } else {
    historyKeyMap['Mod-y'] = redo;
  }

  const plugins = [
    keymap({
      'Mod-b': toggleMark(schema.marks.strong),
      'Mod-i': toggleMark(schema.marks.em),
      'Mod-`': toggleMark(schema.marks.code),
    }),
    keymap({
      Enter: splitListItem(schema.nodes.list_item),
      'Mod-[': liftListItem(schema.nodes.list_item),
      'Mod-]': sinkListItem(schema.nodes.list_item),
      Tab: sinkListItem(schema.nodes.list_item)
    }),
    keymap(baseKeymap)
  ];

  if (options.history) {
    plugins.push(keymap(historyKeyMap));
  }

  return plugins;
};

const getDefaultPlugins = (schema: Schema, options: Options) => {
  const plugins: Plugin[] = [];

  if (options.keyboardShortcuts) {
    plugins.push(...getKeyboardShortcuts(schema, { history: options.history }));
  }

  if (options.history) {
    plugins.push(history());
  }

  if (options.inputRules) {
    plugins.push(buildInputRules(schema));
  }

  return plugins;
};

export default getDefaultPlugins;

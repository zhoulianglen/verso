import { Extension } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import { ReactRenderer } from "@tiptap/react";
import Suggestion from "@tiptap/suggestion";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import type { Editor as TiptapEditor } from "@tiptap/core";
import type { ReactNode } from "react";
import type { TranslateFn } from "../../i18n";
import {
  PilcrowIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  Heading4Icon,
  ListIcon,
  ListOrderedIcon,
  CheckSquareIcon,
  QuoteIcon,
  CodeIcon,
  SeparatorIcon,
  ImageIcon,
  TableIcon,
} from "../icons";
import { SlashCommandList, type SlashCommandListRef } from "./SlashCommandList";

export interface SlashCommandItem {
  title: string;
  description: string;
  icon: ReactNode;
  aliases: string[];
  command: (editor: TiptapEditor) => void;
}

export function getSlashCommands(t: TranslateFn): SlashCommandItem[] {
  return [
    {
      title: t("slash.text"),
      description: t("slash.textDesc"),
      icon: <PilcrowIcon />,
      aliases: ["paragraph", "body", "plain", "normal", "text"],
      command: (editor) => {
        editor.chain().focus().setParagraph().run();
      },
    },
    {
      title: t("slash.heading1"),
      description: t("slash.heading1Desc"),
      icon: <Heading1Icon />,
      aliases: ["h1", "heading", "title"],
      command: (editor) => {
        editor.chain().focus().toggleHeading({ level: 1 }).run();
      },
    },
    {
      title: t("slash.heading2"),
      description: t("slash.heading2Desc"),
      icon: <Heading2Icon />,
      aliases: ["h2", "heading", "subtitle"],
      command: (editor) => {
        editor.chain().focus().toggleHeading({ level: 2 }).run();
      },
    },
    {
      title: t("slash.heading3"),
      description: t("slash.heading3Desc"),
      icon: <Heading3Icon />,
      aliases: ["h3", "heading"],
      command: (editor) => {
        editor.chain().focus().toggleHeading({ level: 3 }).run();
      },
    },
    {
      title: t("slash.heading4"),
      description: t("slash.heading4Desc"),
      icon: <Heading4Icon />,
      aliases: ["h4", "heading"],
      command: (editor) => {
        editor.chain().focus().toggleHeading({ level: 4 }).run();
      },
    },
    {
      title: t("slash.bulletList"),
      description: t("slash.bulletListDesc"),
      icon: <ListIcon />,
      aliases: ["ul", "unordered", "list"],
      command: (editor) => {
        editor.chain().focus().toggleBulletList().run();
      },
    },
    {
      title: t("slash.numberedList"),
      description: t("slash.numberedListDesc"),
      icon: <ListOrderedIcon />,
      aliases: ["ol", "ordered", "list", "numbered"],
      command: (editor) => {
        editor.chain().focus().toggleOrderedList().run();
      },
    },
    {
      title: t("slash.taskList"),
      description: t("slash.taskListDesc"),
      icon: <CheckSquareIcon />,
      aliases: ["todo", "checklist", "checkbox"],
      command: (editor) => {
        editor.chain().focus().toggleTaskList().run();
      },
    },
    {
      title: t("slash.blockquote"),
      description: t("slash.blockquoteDesc"),
      icon: <QuoteIcon />,
      aliases: ["quote"],
      command: (editor) => {
        editor.chain().focus().toggleBlockquote().run();
      },
    },
    {
      title: t("slash.codeBlock"),
      description: t("slash.codeBlockDesc"),
      icon: <CodeIcon />,
      aliases: ["code", "fenced", "pre"],
      command: (editor) => {
        editor.chain().focus().toggleCodeBlock().run();
      },
    },
    {
      title: t("slash.horizontalRule"),
      description: t("slash.horizontalRuleDesc"),
      icon: <SeparatorIcon />,
      aliases: ["divider", "separator", "hr", "line"],
      command: (editor) => {
        editor.chain().focus().setHorizontalRule().run();
      },
    },
    {
      title: t("slash.image"),
      description: t("slash.imageDesc"),
      icon: <ImageIcon />,
      aliases: ["picture", "photo", "img"],
      command: (editor) => {
        editor.chain().focus().run();
        window.dispatchEvent(new CustomEvent("slash-command-image"));
      },
    },
    {
      title: t("slash.table"),
      description: t("slash.tableDesc"),
      icon: <TableIcon />,
      aliases: ["grid"],
      command: (editor) => {
        editor
          .chain()
          .focus()
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run();
      },
    },
  ];
}

const slashCommandPluginKey = new PluginKey("slashCommand");

export const SlashCommand = Extension.create({
  name: "slashCommand",

  addStorage() {
    return {
      t: ((key: string) => key) as TranslateFn,
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashCommandItem>({
        editor: this.editor,
        char: "/",
        pluginKey: slashCommandPluginKey,
        allowSpaces: false,
        startOfLine: true,

        allow: ({ editor }) => {
          return (
            !editor.isActive("codeBlock") && !editor.isActive("frontmatter")
          );
        },

        items: ({ query, editor }) => {
          const t = (editor.storage as any).slashCommand?.t as TranslateFn || ((k: string) => k);
          const commands = getSlashCommands(t);
          const q = query.toLowerCase();
          return commands.filter(
            (item) =>
              item.title.toLowerCase().includes(q) ||
              item.description.toLowerCase().includes(q) ||
              item.aliases.some((alias) => alias.includes(q)),
          );
        },

        command: ({ editor, range, props: item }) => {
          editor.chain().focus().deleteRange(range).run();
          item.command(editor);
        },

        render: () => {
          let component: ReactRenderer<SlashCommandListRef> | null = null;
          let popup: TippyInstance | null = null;

          return {
            onStart: (props) => {
              component = new ReactRenderer(SlashCommandList, {
                props: {
                  items: props.items,
                  command: props.command,
                },
                editor: props.editor,
              });

              popup = tippy(document.body, {
                getReferenceClientRect: () =>
                  props.clientRect?.() ?? new DOMRect(),
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: "manual",
                placement: "bottom-start",
                offset: [0, 4],
                popperOptions: {
                  modifiers: [
                    {
                      name: "flip",
                      options: { fallbackPlacements: ["top-start"] },
                    },
                  ],
                },
              });
            },

            onUpdate: (props) => {
              component?.updateProps({
                items: props.items,
                command: props.command,
              });

              popup?.setProps({
                getReferenceClientRect: () =>
                  props.clientRect?.() ?? new DOMRect(),
              });
            },

            onKeyDown: (props) => {
              if (props.event.key === "Escape") {
                popup?.hide();
                return true;
              }
              return component?.ref?.onKeyDown(props) ?? false;
            },

            onExit: () => {
              popup?.destroy();
              component?.destroy();
              popup = null;
              component = null;
            },
          };
        },
      }),
    ];
  },
});

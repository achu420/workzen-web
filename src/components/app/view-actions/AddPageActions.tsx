import { Fragment, ReactNode, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { DatabaseTemplateSummary } from '@/application/services/js-services/http/database-template-api';
import { DocumentTemplateSummary } from '@/application/services/js-services/http/document-template-api';
import { View, ViewLayout } from '@/application/types';
import { isSpaceView } from '@/application/view-utils';
import { ReactComponent as UploadIcon } from '@/assets/icons/upload.svg';
import { DatabaseViewCreationItem } from '@/components/_shared/DatabaseViewCreationItem';
import { ViewIcon } from '@/components/_shared/view-icon';
import { buildInitialAIChatSettings } from '@/components/ai-chat/chat-settings';
import {
  useAIEnabled,
  useAppOperations,
  useCurrentWorkspaceId,
  useOpenPageModal,
  useToView,
} from '@/components/app/app.hooks';
import { useDatabaseTemplates } from '@/components/app/hooks/useDatabaseTemplates';
import { useDatabaseViewCreation } from '@/components/app/hooks/useDatabaseViewCreation';
import { useDocumentTemplates } from '@/components/app/hooks/useDocumentTemplates';
import { groupByCategory } from '@/components/app/view-actions/group-templates';
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { getErrorMessage } from '@/utils/errors';

// DatabaseViewLayout (Grid 0, Board 1, Calendar 2) -> the sidebar ViewLayout icon.
function templateLayout(databaseLayout: number): ViewLayout {
  if (databaseLayout === 1) return ViewLayout.Board;
  if (databaseLayout === 2) return ViewLayout.Calendar;
  return ViewLayout.Grid;
}

function AddPageActions({
  view,
  onImportClick,
  onClose,
}: {
  view: View;
  onImportClick?: (view: View) => void;
  onClose?: () => void;
}) {
  const { t } = useTranslation();
  const { addPage, addPageFromTemplate, addDocumentFromTemplate, getSubscriptions } = useAppOperations();
  const openPageModal = useOpenPageModal();
  const toView = useToView();
  const aiEnabled = useAIEnabled();
  const currentWorkspaceId = useCurrentWorkspaceId();
  const { getAction, checkCreation } = useDatabaseViewCreation({
    getSubscriptions,
    workspaceId: currentWorkspaceId,
  });
  const lastChildViewId = view.children?.[view.children.length - 1]?.view_id;
  // The server only creates templates directly under a Space.
  const templatesEnabled = !!addPageFromTemplate && isSpaceView(view);
  const templates = useDatabaseTemplates(templatesEnabled);
  const documentTemplatesEnabled = !!addDocumentFromTemplate && isSpaceView(view);
  const documentTemplates = useDocumentTemplates(documentTemplatesEnabled);
  const handleAddDocumentFromTemplate = useCallback(
    async (template: DocumentTemplateSummary) => {
      if (!addDocumentFromTemplate) return;
      const loadingToastId = toast.loading(t('document.creating'));

      try {
        const viewId = await addDocumentFromTemplate(view.view_id, { templateId: template.template_id });

        void openPageModal?.(viewId);
        toast.dismiss(loadingToastId);
      } catch (e: unknown) {
        toast.dismiss(loadingToastId);
        toast.error(getErrorMessage(e, 'Failed to create page'));
      }
    },
    [addDocumentFromTemplate, openPageModal, t, view.view_id]
  );
  const handleAddFromTemplate = useCallback(
    async (template: DatabaseTemplateSummary) => {
      if (!addPageFromTemplate) return;
      const loadingToastId = toast.loading(t('document.creating'));

      try {
        const viewId = await addPageFromTemplate(view.view_id, { templateId: template.template_id });

        void toView(viewId);
        toast.dismiss(loadingToastId);
      } catch (e: unknown) {
        toast.dismiss(loadingToastId);
        toast.error(getErrorMessage(e, 'Failed to create page'));
      }
    },
    [addPageFromTemplate, t, toView, view.view_id]
  );
  const handleAddPage = useCallback(
    async (layout: ViewLayout, name?: string) => {
      if (!addPage) return;
      if (layout === ViewLayout.AIChat && !aiEnabled) return;
      if (!checkCreation(layout, onClose)) return;
      const loadingToastId = toast.loading(t('document.creating'));

      try {
        // Append after the last child so the new page appears at the bottom.
        // When prev_view_id is omitted the backend prepends (inserts at index 0).
        const response = await addPage(view.view_id, { layout, name, prev_view_id: lastChildViewId });

        if (layout === ViewLayout.AIChat && currentWorkspaceId) {
          try {
            const [{ ChatRequest }, { getAxiosInstance }] = await Promise.all([
              import('@/components/chat/request'),
              import('@/application/services/js-services/http'),
            ]);
            const axiosInstance = getAxiosInstance();

            if (!axiosInstance) {
              throw new Error('Missing axios instance');
            }

            const request = new ChatRequest(currentWorkspaceId, response.view_id, axiosInstance);
            const scopedParent = isSpaceView(view) ? view : await request.getView(view.view_id);
            const initialSettings = buildInitialAIChatSettings({ parent: scopedParent });

            if (Object.keys(initialSettings).length > 0) {
              await request.updateChatSettings(initialSettings);
            }
          } catch {
            toast.error(
              t('search.updateAIChatSettingsFailed', {
                defaultValue: 'AI chat was created, but the context could not be attached',
              })
            );
          }
        }

        if (layout === ViewLayout.Document) {
          void openPageModal?.(response.view_id);
        } else {
          void toView(response.view_id);
        }

        toast.dismiss(loadingToastId);
      } catch (e: unknown) {
        toast.dismiss(loadingToastId);
        toast.error(getErrorMessage(e, 'Failed to create page'));
      }
    },
    [addPage, aiEnabled, currentWorkspaceId, lastChildViewId, openPageModal, t, checkCreation, onClose, toView, view]
  );

  const actions: {
    label: string;
    icon: ReactNode;
    testId?: string;
    layout?: ViewLayout;
    onSelect: () => void | Promise<void>;
  }[] = useMemo(
    () => [
      {
        label: t('document.menuName'),
        icon: <ViewIcon layout={ViewLayout.Document} size={'small'} />,
        testId: 'add-document-button',
        onSelect: () => {
          void handleAddPage(ViewLayout.Document, t('menuAppHeader.defaultNewPageName'));
        },
      },
      {
        label: t('grid.menuName'),
        icon: <ViewIcon layout={ViewLayout.Grid} size={'small'} />,
        testId: 'add-grid-button',
        onSelect: () => {
          void handleAddPage(ViewLayout.Grid, t('document.plugins.database.newDatabase'));
        },
      },
      {
        label: t('board.menuName'),
        icon: <ViewIcon layout={ViewLayout.Board} size={'small'} />,
        onSelect: () => {
          void handleAddPage(ViewLayout.Board, t('document.plugins.database.newDatabase'));
        },
      },
      {
        label: t('calendar.menuName'),
        icon: <ViewIcon layout={ViewLayout.Calendar} size={'medium'} />,
        onSelect: () => {
          void handleAddPage(ViewLayout.Calendar, t('document.plugins.database.newDatabase'));
        },
      },
      {
        label: t('timeline.menuName', { defaultValue: 'Timeline' }),
        icon: <ViewIcon layout={ViewLayout.Timeline} size={'medium'} />,
        testId: 'add-timeline-page-button',
        layout: ViewLayout.Timeline,
        onSelect: () => {
          void handleAddPage(ViewLayout.Timeline, t('document.plugins.database.newDatabase'));
        },
      },
      ...(aiEnabled
        ? [
            {
              label: t('chat.newChat'),
              icon: <ViewIcon layout={ViewLayout.AIChat} size={'small'} />,
              testId: 'add-ai-chat-button',
              onSelect: () => {
                void handleAddPage(ViewLayout.AIChat, t('menuAppHeader.defaultNewPageName'));
              },
            },
          ]
        : []),
      {
        label: t('chart.menuName'),
        icon: <ViewIcon layout={ViewLayout.Chart} size={'small'} />,
        testId: 'add-chart-button',
        layout: ViewLayout.Chart,
        onSelect: () => {
          void handleAddPage(ViewLayout.Chart, t('document.plugins.database.newDatabase'));
        },
      },
      {
        label: t('form.menuName'),
        icon: <ViewIcon layout={ViewLayout.Form} size={'small'} />,
        testId: 'add-form-button',
        layout: ViewLayout.Form,
        onSelect: () => handleAddPage(ViewLayout.Form, t('document.plugins.database.newDatabase')),
      },
      {
        label: t('list.menuName'),
        icon: <ViewIcon layout={ViewLayout.List} size={'small'} />,
        testId: 'add-list-button',
        onSelect: () => {
          void handleAddPage(ViewLayout.List, t('document.plugins.database.newDatabase'));
        },
      },
      {
        label: t('gallery.menuName'),
        icon: <ViewIcon layout={ViewLayout.Gallery} size={'small'} />,
        testId: 'add-gallery-button',
        onSelect: () => {
          void handleAddPage(ViewLayout.Gallery, t('document.plugins.database.newDatabase'));
        },
      },
      {
        label: t('feed.menuName'),
        icon: <ViewIcon layout={ViewLayout.Feed} size={'small'} />,
        testId: 'add-feed-button',
        onSelect: () => {
          void handleAddPage(ViewLayout.Feed, t('document.plugins.database.newDatabase'));
        },
      },
      {
        label: t('moreAction.import'),
        icon: <UploadIcon className='h-5 w-5 text-icon-primary' />,
        testId: 'add-import-button',
        onSelect: () => {
          onImportClick?.(view);
        },
      },
    ],
    [aiEnabled, handleAddPage, t, onImportClick, view]
  );

  return (
    <DropdownMenuGroup className='max-h-[min(60vh,560px)] overflow-y-auto'>
      {actions.map((action) => (
        <DatabaseViewCreationItem
          key={action.label}
          layout={action.layout}
          action={getAction(action.layout)}
          data-testid={action.testId}
          onSelect={() => void action.onSelect()}
        >
          {action.icon}
          {action.label}
        </DatabaseViewCreationItem>
      ))}
      {templatesEnabled && templates.length > 0 && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>{t('template.menuName', { defaultValue: 'Templates' })}</DropdownMenuLabel>
          {groupByCategory(templates).map(({ category, items }) => (
            <Fragment key={category ?? 'built-in'}>
              {category && <DropdownMenuLabel className={'text-xs text-text-tertiary'}>{category}</DropdownMenuLabel>}
              {items.map((template) => (
                <DropdownMenuItem
                  key={template.template_id}
                  data-testid={`add-database-template-${template.template_id}`}
                  title={template.description}
                  onSelect={() => void handleAddFromTemplate(template)}
                >
                  <ViewIcon layout={templateLayout(template.primary_layout)} size={'small'} />
                  {template.name}
                </DropdownMenuItem>
              ))}
            </Fragment>
          ))}
        </>
      )}
      {documentTemplatesEnabled && documentTemplates.length > 0 && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>{t('template.pageTemplates', { defaultValue: 'Page templates' })}</DropdownMenuLabel>
          {groupByCategory(documentTemplates).map(({ category, items }) => (
            <Fragment key={category ?? 'built-in'}>
              {category && <DropdownMenuLabel className={'text-xs text-text-tertiary'}>{category}</DropdownMenuLabel>}
              {items.map((template) => (
                <DropdownMenuItem
                  key={template.template_id}
                  data-testid={`add-document-template-${template.template_id}`}
                  title={template.description}
                  onSelect={() => void handleAddDocumentFromTemplate(template)}
                >
                  <ViewIcon layout={ViewLayout.Document} size={'small'} />
                  {template.name}
                </DropdownMenuItem>
              ))}
            </Fragment>
          ))}
        </>
      )}
    </DropdownMenuGroup>
  );
}

export default AddPageActions;

// @ts-nocheck
import { useRef, useState, type FormEvent } from 'react';
import { Check } from 'lucide-react';
import type { ProjectInput } from '../../types';
import { PROJECT_COLORS } from '../../lib/tasks';
import { cn } from '../../lib/utils';
import { useData } from '../../store/DataContext';
import { useUI } from '../../store/UIContext';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';

const FORM_ID = 'project-form';

export function ProjectFormModal() {
  const { projectForm, closeProjectForm, navigate } = useUI();
  const { projects, createProject, updateProject } = useData();
  const toast = useToast();
  const sessionRef = useRef(0);
  if (projectForm.open) sessionRef.current = projectForm.session;
  const session = sessionRef.current;
  const editing = projectForm.open && projectForm.projectId ? projects.find((p) => p.id === projectForm.projectId) : undefined;

  const submit = (input: ProjectInput) => {
    if (editing) {
      updateProject(editing.id, input);
      toast({ title: 'Project updated', description: input.name });
    } else {
      const project = createProject(input);
      toast({ title: 'Project created', description: input.name });
      navigate({ name: 'project', id: project.id });
    }
    closeProjectForm();
  };

  return (
    <Modal
      open={projectForm.open}
      onClose={closeProjectForm}
      title={editing ? 'Edit project' : 'New project'}
      description={editing ? undefined : 'Group related tasks and track progress together.'}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={closeProjectForm}>
            Cancel
          </button>
          <button type="submit" form={FORM_ID} className="btn-primary">
            {editing ? 'Save changes' : 'Create project'}
          </button>
        </>
      }
    >
      <ProjectForm
        key={session}
        initial={editing ?? { name: '', description: '', color: PROJECT_COLORS[projects.length % PROJECT_COLORS.length] }}
        existingNames={projects.filter((p) => p.id !== editing?.id).map((p) => p.name.toLowerCase())}
        onSubmit={submit}
      />
    </Modal>
  );
}

function ProjectForm({ initial, existingNames, onSubmit }: { initial: ProjectInput; existingNames: string[]; onSubmit: (v: ProjectInput) => void }) {
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [color, setColor] = useState(initial.color);
  const [error, setError] = useState<string | null>(null);

  const handle = (e: FormEvent) => {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) return setError('Project name is required.');
    if (clean.length > 60) return setError('Project name must be 60 characters or fewer.');
    if (existingNames.includes(clean.toLowerCase())) return setError('A project with this name already exists.');
    onSubmit({ name: clean, description: description.trim().slice(0, 300), color });
  };

  return (
    <form id={FORM_ID} onSubmit={handle} noValidate className="space-y-5 pb-2">
      <div>
        <label htmlFor="project-name" className="label">
          Name
        </label>
        <input
          id="project-name"
          data-autofocus
          className={cn('input', error && 'input-error')}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          placeholder="e.g. Website Redesign"
          aria-invalid={!!error}
        />
        {error && (
          <p role="alert" className="mt-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
            {error}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="project-description" className="label">
          Description <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <textarea
          id="project-description"
          rows={3}
          maxLength={300}
          className="input h-auto resize-none py-2.5"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is this project about?"
        />
        <p className="mt-1 text-right text-[11px] text-slate-400">{description.length}/300</p>
      </div>
      <div>
        <span className="label">Color</span>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Project color">
          {PROJECT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              aria-label={`Color ${c}`}
              onClick={() => setColor(c)}
              className={cn(
                'grid h-8 w-8 place-items-center rounded-lg transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:ring-offset-ink-900',
                color === c && 'ring-2 ring-offset-2 dark:ring-offset-ink-900',
              )}
              style={{ backgroundColor: c, ['--tw-ring-color' as string]: c }}
            >
              {color === c && <Check className="h-4 w-4 text-white" strokeWidth={3} />}
            </button>
          ))}
        </div>
      </div>
    </form>
  );
}

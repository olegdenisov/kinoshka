import s from './EmptyState.module.css';

type Props = {
  title: string;
  description: string;
};

export const EmptyState = ({
  title,
  description,
}: Props) => {
  return (
    <div className={s.wrap}>
      <p className={s.title}>{title}</p>
      <p className={s.description}>{description}</p>
    </div>
  );
};
import { getBySinglePropertyDl } from '../utils/dataloader';
import { Project } from './project.entity';

export class ProjectService {
  getProjectByInternalId = getBySinglePropertyDl(Project, 'internalId');
}

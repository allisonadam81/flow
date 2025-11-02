import { sleep } from '@allisonadam81/flow';

const users = [
  {
    firstName: 'Jimmy',
    lastName: 'Bananas',
    description:
      'Savy and interesting. Kinda sneaky, but loveable and means well.',
  },
  {
    firstName: 'Jackie',
    lastName: 'Mangoes',
    description:
      'An overall do-gooder. Wants to help everyone, sometimes to a fault.',
  },
  {
    firstName: 'Johnny',
    lastName: 'Apples',
    description:
      "Young and spunky. A little chip on the shoulder. A classic mean-muggin' New Yorker",
  },
  {
    firstName: 'Jerry',
    lastName: 'Jalapenos',
    description:
      'A high-powered businessman. Makes a lot of money, but it drives him to drinking. Big whiskey drinker',
  },
].map((u, i) => ({ ...u, id: i + 1 }));
users.push(null);

export const getUser = async (id) => {
  await sleep(2000);
  return users[id];
};

export const getAllUsers = async () => {
  await sleep(1000);
  return users;
};

import { useState, useEffect } from 'react';
import './App.css';
import {
  Task,
  Result,
  compose,
  flatMap,
  tryResult,
  identity,
} from '@allisonadam81/flow';
import { getAllUsers } from './mock';

function App() {
  const [count, setCount] = useState(0);

  const { users } = useUsers();

  return (
    <>
      <h1>Count Stuff</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
      </div>
      <div>
        <ul>
          {users.map((u) => (
            <li key={u.id}>
              <p>{u.id}</p>
              <h2>{u.name}</h2>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

const toBrokenUser = () => ({ id: 0, name: 'Oops! This user is unavailable' });

const toJoinedNames = (u) => ({
  name: `${u.firstName} ${u.lastName}`,
  id: u.id,
});

const composeToJoinedNames = compose(tryResult, flatMap)(toJoinedNames);

const transformUsers = (users) => {
  return Result.Ok(users)
    .sequence()
    .map((users) => users.map(composeToJoinedNames))
    .map((users) => users.map((res) => res.fold(toBrokenUser, identity)));
};

const useUsers = () => {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    Task.of(getAllUsers)
      .run()
      .then(transformUsers)
      .then((res) => res.fold(() => setIsError(true), identity))
      .then(setUsers)
      .catch((e) => {
        setIsError(true);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  return { users, setUsers, isLoading };
};

export default App;

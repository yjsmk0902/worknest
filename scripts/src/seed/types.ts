import { LoginSuccessOutput, Mutation } from '@worknest/core';

export type FakerAccount = {
  name: string;
  email: string;
  password: string;
  avatar: string;
};

export type User = {
  login: LoginSuccessOutput;
  userId: string;
  mutations: Mutation[];
};

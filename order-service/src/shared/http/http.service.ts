import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class HttpService {
  async get(url: string, params?: object) {
    const response = await axios.get(url, {
      params,
    });

    return response.data;
  }

  async post(url: string, body?: any) {
    const response = await axios.post(url, body);

    return response.data;
  }
}